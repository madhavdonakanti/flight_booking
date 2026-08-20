from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Aircraft',
            fields=[
                ('aircraft_id', models.AutoField(primary_key=True, serialize=False)),
                ('tail_number', models.CharField(max_length=50, unique=True)),
                ('manufacturer', models.CharField(max_length=100)),
                ('model', models.CharField(max_length=100)),
                ('total_capacity', models.IntegerField()),
                ('manufacture_year', models.IntegerField(blank=True, null=True)),
            ],
        ),
        migrations.CreateModel(
            name='Employee',
            fields=[
                ('employee_id', models.AutoField(primary_key=True, serialize=False)),
                ('first_name', models.CharField(max_length=255)),
                ('last_name', models.CharField(max_length=255)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('hire_date', models.DateField()),
            ],
        ),
        migrations.CreateModel(
            name='Flight',
            fields=[
                ('flight_id', models.AutoField(primary_key=True, serialize=False)),
                ('flight_number', models.CharField(max_length=20, unique=True)),
                ('origin_airport_code', models.CharField(max_length=3)),
                ('destination_airport_code', models.CharField(max_length=3)),
                ('base_duration_minutes', models.IntegerField()),
            ],
        ),
        migrations.CreateModel(
            name='Passenger',
            fields=[
                ('passenger_id', models.AutoField(primary_key=True, serialize=False)),
                ('first_name', models.CharField(max_length=255)),
                ('last_name', models.CharField(max_length=255)),
                ('date_of_birth', models.DateField()),
                ('passport_number', models.CharField(blank=True, max_length=100, null=True, unique=True)),
                ('nationality', models.CharField(blank=True, max_length=100, null=True)),
            ],
        ),
        migrations.CreateModel(
            name='Role',
            fields=[
                ('role_id', models.AutoField(primary_key=True, serialize=False)),
                ('role_name', models.CharField(max_length=100, unique=True)),
                ('description', models.TextField(blank=True, null=True)),
            ],
        ),
        migrations.CreateModel(
            name='TravelAgency',
            fields=[
                ('agency_id', models.AutoField(primary_key=True, serialize=False)),
                ('agency_name', models.CharField(max_length=255)),
                ('contact_email', models.EmailField(max_length=254, unique=True)),
                ('contact_phone', models.CharField(max_length=50)),
                ('commission_rate', models.DecimalField(decimal_places=4, max_digits=5)),
            ],
        ),
        migrations.CreateModel(
            name='User',
            fields=[
                ('user_id', models.AutoField(primary_key=True, serialize=False)),
                ('first_name', models.CharField(max_length=255)),
                ('last_name', models.CharField(max_length=255)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('phone_number', models.CharField(blank=True, max_length=50, null=True)),
                ('password_hash', models.CharField(max_length=255)),
                ('created_at', models.DateTimeField()),
            ],
        ),
        migrations.CreateModel(
            name='Seat',
            fields=[
                ('seat_id', models.AutoField(primary_key=True, serialize=False)),
                ('seat_number', models.CharField(max_length=10)),
                ('seat_class', models.CharField(max_length=50)),
                ('aircraft', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='seats', to='api.aircraft')),
            ],
        ),
        migrations.CreateModel(
            name='Schedule',
            fields=[
                ('schedule_id', models.AutoField(primary_key=True, serialize=False)),
                ('departure_time', models.DateTimeField()),
                ('arrival_time', models.DateTimeField()),
                ('flight_status', models.CharField(max_length=50)),
                ('aircraft', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='schedules', to='api.aircraft')),
                ('flight', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='schedules', to='api.flight')),
            ],
        ),
        migrations.CreateModel(
            name='Booking',
            fields=[
                ('booking_id', models.AutoField(primary_key=True, serialize=False)),
                ('booking_date', models.DateTimeField()),
                ('total_price', models.DecimalField(decimal_places=2, max_digits=10)),
                ('booking_status', models.CharField(max_length=50)),
                ('agency', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bookings', to='api.travelagency')),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='bookings', to='api.user')),
            ],
        ),
        migrations.CreateModel(
            name='Payment',
            fields=[
                ('payment_id', models.AutoField(primary_key=True, serialize=False)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('payment_date', models.DateTimeField()),
                ('payment_method', models.CharField(max_length=50)),
                ('transaction_id', models.CharField(max_length=255, unique=True)),
                ('payment_status', models.CharField(max_length=50)),
                ('booking', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='payments', to='api.booking')),
            ],
        ),
        migrations.CreateModel(
            name='Ticket',
            fields=[
                ('ticket_id', models.AutoField(primary_key=True, serialize=False)),
                ('ticket_number', models.CharField(max_length=100, unique=True)),
                ('fare_paid', models.DecimalField(decimal_places=2, max_digits=10)),
                ('boarding_group', models.CharField(blank=True, max_length=50, null=True)),
                ('aircraft', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tickets', to='api.aircraft')),
                ('booking', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tickets', to='api.booking')),
                ('passenger', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tickets', to='api.passenger')),
                ('schedule', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tickets', to='api.schedule')),
                ('seat', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tickets', to='api.seat')),
            ],
        ),
        migrations.CreateModel(
            name='EmployeeRole',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='employee_roles', to='api.employee')),
                ('role', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='employee_roles', to='api.role')),
            ],
        ),
        migrations.CreateModel(
            name='BookingProcessing',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action_timestamp', models.DateTimeField()),
                ('action_type', models.CharField(max_length=100)),
                ('notes', models.TextField(blank=True, null=True)),
                ('booking', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='booking_processings', to='api.booking')),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='booking_processings', to='api.employee')),
            ],
        ),
        migrations.CreateModel(
            name='BookingPassenger',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('special_requests', models.TextField(blank=True, null=True)),
                ('booking', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='booking_passengers', to='api.booking')),
                ('passenger', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='booking_passengers', to='api.passenger')),
            ],
        ),
        migrations.AddConstraint(
            model_name='seat',
            constraint=models.UniqueConstraint(fields=('aircraft', 'seat_number'), name='uq_seat_aircraft_number'),
        ),
        migrations.AddConstraint(
            model_name='booking',
            constraint=models.CheckConstraint(condition=models.Q(models.Q(('agency__isnull', True), ('user__isnull', False)), models.Q(('agency__isnull', False), ('user__isnull', True)), _connector='OR'), name='chk_booking_owner'),
        ),
        migrations.AddConstraint(
            model_name='ticket',
            constraint=models.UniqueConstraint(fields=('seat', 'schedule'), name='uq_ticket_seat_schedule'),
        ),
        migrations.AddConstraint(
            model_name='employeerole',
            constraint=models.UniqueConstraint(fields=('employee', 'role'), name='pk_employee_role'),
        ),
        migrations.AddConstraint(
            model_name='bookingprocessing',
            constraint=models.UniqueConstraint(fields=('employee', 'booking', 'action_timestamp'), name='pk_booking_processing'),
        ),
        migrations.AddConstraint(
            model_name='bookingpassenger',
            constraint=models.UniqueConstraint(fields=('booking', 'passenger'), name='pk_booking_passenger'),
        ),
    ]
