# pyrefly: ignore [missing-import]
from django.db import models


class User(models.Model):
    user_id = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    password_hash = models.CharField(max_length=255)
    created_at = models.DateTimeField()

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"


class Booking(models.Model):
    booking_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bookings")
    booking_date = models.DateTimeField(db_index=True)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    booking_status = models.CharField(max_length=50)

    def __str__(self):
        return f"Booking #{self.booking_id} - {self.booking_status}"


class Passenger(models.Model):
    passenger_id = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    date_of_birth = models.DateField()
    passport_number = models.CharField(max_length=100, unique=True, blank=True, null=True)
    nationality = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class BookingPassenger(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="booking_passengers")
    passenger = models.ForeignKey(Passenger, on_delete=models.CASCADE, related_name="booking_passengers")
    special_requests = models.TextField(blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["booking", "passenger"], name="pk_booking_passenger")
        ]

    def __str__(self):
        return f"Booking {self.booking_id} - Passenger {self.passenger_id}"


class Payment(models.Model):
    payment_id = models.AutoField(primary_key=True)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateTimeField()
    payment_method = models.CharField(max_length=50)
    transaction_id = models.CharField(max_length=255, unique=True)
    payment_status = models.CharField(max_length=50)

    def __str__(self):
        return f"Payment #{self.payment_id} ({self.payment_status})"


class Flight(models.Model):
    flight_id = models.AutoField(primary_key=True)
    flight_number = models.CharField(max_length=20, unique=True)
    origin_airport_code = models.CharField(max_length=3, db_index=True)
    destination_airport_code = models.CharField(max_length=3, db_index=True)
    base_duration_minutes = models.IntegerField()

    class Meta:
        indexes = [
            models.Index(fields=["origin_airport_code", "destination_airport_code"], name="idx_flight_origin_dest"),
        ]

    def __str__(self):
        return f"{self.flight_number} ({self.origin_airport_code}-{self.destination_airport_code})"


class Aircraft(models.Model):
    aircraft_id = models.AutoField(primary_key=True)
    tail_number = models.CharField(max_length=50, unique=True)
    manufacturer = models.CharField(max_length=100)
    model = models.CharField(max_length=100)
    total_capacity = models.IntegerField()
    manufacture_year = models.IntegerField(blank=True, null=True)

    def __str__(self):
        return f"{self.model} ({self.tail_number})"


class Seat(models.Model):
    seat_id = models.AutoField(primary_key=True)
    aircraft = models.ForeignKey(Aircraft, on_delete=models.CASCADE, related_name="seats")
    seat_number = models.CharField(max_length=10)
    seat_class = models.CharField(max_length=50)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["aircraft", "seat_number"], name="uq_seat_aircraft_number")
        ]

    def __str__(self):
        return f"Seat {self.seat_number} ({self.seat_class}) on Aircraft {self.aircraft_id}"


class Schedule(models.Model):
    schedule_id = models.AutoField(primary_key=True)
    flight = models.ForeignKey(Flight, on_delete=models.CASCADE, related_name="schedules")
    aircraft = models.ForeignKey(Aircraft, on_delete=models.CASCADE, related_name="schedules")
    departure_time = models.DateTimeField(db_index=True)
    arrival_time = models.DateTimeField()
    flight_status = models.CharField(max_length=50)

    class Meta:
        indexes = [
            models.Index(fields=["flight", "departure_time"], name="idx_schedule_flight_dept"),
        ]

    def __str__(self):
        return f"Schedule #{self.schedule_id} - Flight {self.flight_id}"


class Ticket(models.Model):
    ticket_id = models.AutoField(primary_key=True)
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="tickets")
    passenger = models.ForeignKey(Passenger, on_delete=models.CASCADE, related_name="tickets")
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name="tickets")
    seat = models.ForeignKey(Seat, on_delete=models.CASCADE, related_name="tickets")
    aircraft = models.ForeignKey(Aircraft, on_delete=models.CASCADE, related_name="tickets")
    ticket_number = models.CharField(max_length=100, unique=True)
    fare_paid = models.DecimalField(max_digits=10, decimal_places=2)
    boarding_group = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["seat", "schedule"], name="uq_ticket_seat_schedule")
        ]

    def __str__(self):
        return f"Ticket #{self.ticket_number}"


class Employee(models.Model):
    employee_id = models.AutoField(primary_key=True)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    password_hash = models.CharField(max_length=255, blank=True, null=True)
    hire_date = models.DateField()

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class Role(models.Model):
    role_id = models.AutoField(primary_key=True)
    role_name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.role_name


class EmployeeRole(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="employee_roles")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="employee_roles")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["employee", "role"], name="pk_employee_role")
        ]

    def __str__(self):
        return f"Employee {self.employee_id} - Role {self.role_id}"


class BookingProcessing(models.Model):
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="booking_processings")
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE, related_name="booking_processings")
    action_timestamp = models.DateTimeField()
    action_type = models.CharField(max_length=100)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["employee", "booking", "action_timestamp"], name="pk_booking_processing")
        ]

    def __str__(self):
        return f"Processing by Employee {self.employee_id} on Booking {self.booking_id}"
