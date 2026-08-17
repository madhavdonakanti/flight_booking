from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='phone_number',
            field=models.CharField(blank=True, db_index=True, max_length=50, null=True),
        ),
        migrations.AlterField(
            model_name='booking',
            name='booking_date',
            field=models.DateTimeField(db_index=True),
        ),
        migrations.AlterField(
            model_name='flight',
            name='origin_airport_code',
            field=models.CharField(db_index=True, max_length=3),
        ),
        migrations.AlterField(
            model_name='flight',
            name='destination_airport_code',
            field=models.CharField(db_index=True, max_length=3),
        ),
        migrations.AddIndex(
            model_name='flight',
            index=models.Index(fields=['origin_airport_code', 'destination_airport_code'], name='idx_flight_origin_dest'),
        ),
        migrations.AlterField(
            model_name='schedule',
            name='departure_time',
            field=models.DateTimeField(db_index=True),
        ),
        migrations.AddIndex(
            model_name='schedule',
            index=models.Index(fields=['flight', 'departure_time'], name='idx_schedule_flight_dept'),
        ),
    ]
