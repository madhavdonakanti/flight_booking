from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = (
        "Apply SQL-first business schema scripts from back_end/ against the configured "
        "database."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force-reset",
            action="store_true",
            help=(
                "Re-apply schema from scratch. WARNING: this runs the base schema file "
                "that drops business tables."
            ),
        )
        parser.add_argument(
            "--skip-access-control",
            action="store_true",
            help="Skip access control script (roles, grants, views, and RLS policy).",
        )

    def handle(self, *args, **options):
        force_reset = options["force_reset"]
        skip_access_control = options["skip_access_control"]

        scripts = self._resolve_scripts(skip_access_control=skip_access_control)
        core_tables = {"booking", "flight", "schedule", "ticket"}
        existing_core_tables = self._existing_tables(core_tables)

        if 0 < len(existing_core_tables) < len(core_tables) and not force_reset:
            existing_sorted = ", ".join(sorted(existing_core_tables))
            missing_sorted = ", ".join(sorted(core_tables - existing_core_tables))
            raise CommandError(
                "Partial business schema detected. Existing core tables: "
                f"{existing_sorted}. Missing core tables: {missing_sorted}. "
                "Run with --force-reset to rebuild from scratch."
            )

        if len(existing_core_tables) == len(core_tables) and not force_reset:
            self.stdout.write(
                self.style.SUCCESS(
                    "Business schema already exists. No SQL schema scripts were executed."
                )
            )
            return

        if force_reset:
            self.stdout.write(
                self.style.WARNING(
                    "--force-reset enabled. The base schema script will drop existing "
                    "business tables before recreating them."
                )
            )

        for script_path in scripts:
            self._apply_script(script_path)

        self.stdout.write(self.style.SUCCESS("Business schema bootstrap completed."))

    def _resolve_scripts(self, skip_access_control):
        back_end_dir = Path(settings.BASE_DIR).parent
        scripts = [
            back_end_dir / "basic_database_struc.sql",
            back_end_dir / "t=1_booking_constraint_db.sql",
        ]

        if not skip_access_control:
            scripts.append(back_end_dir / "access_control_db.sql")

        missing = [str(path) for path in scripts if not path.exists()]
        if missing:
            raise CommandError(
                "Missing required SQL script files: " + ", ".join(missing)
            )

        return scripts

    def _existing_tables(self, table_names):
        placeholders = ", ".join(["%s"] * len(table_names))
        query = f"""
            SELECT lower(table_name)
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND lower(table_name) IN ({placeholders})
        """

        with connection.cursor() as cursor:
            cursor.execute(query, list(table_names))
            return {row[0] for row in cursor.fetchall()}

    def _apply_script(self, script_path):
        sql = script_path.read_text(encoding="utf-8").strip()
        if not sql:
            self.stdout.write(
                self.style.WARNING(f"Skipping empty SQL script: {script_path.name}")
            )
            return

        self.stdout.write(f"Applying {script_path.name} ...")
        with connection.cursor() as cursor:
            cursor.execute(sql)

        self.stdout.write(self.style.SUCCESS(f"Applied {script_path.name}"))
