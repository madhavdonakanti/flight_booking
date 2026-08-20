from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0002_add_performance_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='employee',
            name='password_hash',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.RemoveConstraint(
            model_name='booking',
            name='chk_booking_owner',
        ),
        migrations.RemoveField(
            model_name='booking',
            name='agency',
        ),
        migrations.AlterField(
            model_name='booking',
            name='user',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='bookings', to='api.user'),
        ),
        migrations.DeleteModel(
            name='TravelAgency',
        ),
    ]
