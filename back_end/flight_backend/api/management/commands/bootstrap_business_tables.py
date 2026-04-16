from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection

CORE_TABLES = {
    "aircraft",
    "booking",
    "booking_passenger",
    "booking_processing",
    "employee",
    "employee_role",
    "flight",
    "passenger",
    "payment",
    "role",
    "schedule",
    "seat",
    "ticket",
    "travel_agency",
    "user",
}


class Command(BaseCommand):
    help = (
        "Create SQL-first business tables from basic_database_struc.sql "
        "if they are missing."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--force-reset",
            action="store_true",
            help=(
                "Recreate business tables from scratch. WARNING: this is destructive "
                "for business data because the SQL script drops tables first."
            ),
        )

    def handle(self, *args, **options):
        force_reset = options["force_reset"]
        existing_core_tables = self._existing_tables(CORE_TABLES)

        if len(existing_core_tables) == len(CORE_TABLES) and not force_reset:
            self.stdout.write(
                self.style.SUCCESS(
                    "Business tables already exist. Skipping table bootstrap."
                )
            )
            return

        if 0 < len(existing_core_tables) < len(CORE_TABLES) and not force_reset:
            existing_sorted = ", ".join(sorted(existing_core_tables))
            missing_sorted = ", ".join(sorted(CORE_TABLES - existing_core_tables))
            raise CommandError(
                "Partial business schema detected. Existing tables: "
                f"{existing_sorted}. Missing tables: {missing_sorted}. "
                "Run with --force-reset to rebuild from scratch."
            )

        if force_reset:
            self.stdout.write(
                self.style.WARNING(
                    "--force-reset enabled. Existing business tables will be dropped "
                    "and recreated by the base schema script."
                )
            )

        self._apply_base_schema()

        self.stdout.write(self.style.SUCCESS("Business table bootstrap completed."))

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

    def _apply_base_schema(self):
        back_end_dir = Path(settings.BASE_DIR).parent
        script_path = back_end_dir / "basic_database_struc.sql"

        if not script_path.exists():
            raise CommandError(f"Missing required SQL file: {script_path}")

        sql = script_path.read_text(encoding="utf-8").strip()
        if not sql:
            raise CommandError(f"SQL file is empty: {script_path}")

        self.stdout.write("Applying basic_database_struc.sql ...")
        with connection.cursor() as cursor:
            cursor.execute(sql)
        self.stdout.write(self.style.SUCCESS("Applied basic_database_struc.sql"))
