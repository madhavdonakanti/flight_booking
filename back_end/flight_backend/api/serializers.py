import re
from rest_framework import serializers


def _validate_10_digit_phone(value):
    clean_phone = re.sub(r"\D", "", value or "")
    if len(clean_phone) != 10:
        raise serializers.ValidationError("Phone number must contain exactly 10 digits.")
    return clean_phone


class UserPayloadSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=40)

    def validate_name(self, value):
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("Name is required.")
        return normalized

    def validate_phone(self, value):
        return _validate_10_digit_phone(value)


class PassengerPayloadSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    passport_number = serializers.CharField(max_length=64, allow_blank=True, allow_null=True)
    birth_date = serializers.DateField()

    def validate_first_name(self, value):
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("Passenger first_name is required.")
        return normalized

    def validate_last_name(self, value):
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("Passenger last_name is required.")
        return normalized

    def validate_passport_number(self, value):
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    def validate_birth_date(self, value):
        from django.utils import timezone
        if value > timezone.now().date():
            raise serializers.ValidationError("Date of birth cannot be in the future.")
        return value


class SeatAssignmentSerializer(serializers.Serializer):
    passenger_index = serializers.IntegerField(min_value=0)
    seat_id = serializers.IntegerField(min_value=1)


class FinalizeBookingSerializer(serializers.Serializer):
    user = UserPayloadSerializer()
    passengers = PassengerPayloadSerializer(many=True)
    schedule_id = serializers.IntegerField(min_value=1)
    seat_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )
    seat_assignments = SeatAssignmentSerializer(many=True, allow_empty=False)

    def validate(self, attrs):
        passengers = attrs["passengers"]
        seat_ids = attrs["seat_ids"]
        seat_assignments = attrs["seat_assignments"]

        if len(passengers) == 0:
            raise serializers.ValidationError("At least one passenger is required.")

        if len(passengers) != len(seat_assignments):
            raise serializers.ValidationError(
                "Each passenger must have exactly one seat assignment."
            )

        if len(seat_ids) != len(seat_assignments):
            raise serializers.ValidationError(
                "seat_ids and seat_assignments must contain the same number of entries."
            )

        passenger_indexes = [entry["passenger_index"] for entry in seat_assignments]
        expected_indexes = set(range(len(passengers)))

        if set(passenger_indexes) != expected_indexes:
            raise serializers.ValidationError(
                "seat_assignments must include one entry per passenger index."
            )

        if len(passenger_indexes) != len(set(passenger_indexes)):
            raise serializers.ValidationError(
                "Duplicate passenger_index values are not allowed."
            )

        assignment_seat_ids = [entry["seat_id"] for entry in seat_assignments]

        if len(assignment_seat_ids) != len(set(assignment_seat_ids)):
            raise serializers.ValidationError("Duplicate seat assignments are not allowed.")

        if sorted(assignment_seat_ids) != sorted(seat_ids):
            raise serializers.ValidationError(
                "seat_ids must match seat_assignments seat_id values."
            )

        return attrs


class BookingLookupSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=40)

    def validate_name(self, value):
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("Name is required.")
        return normalized

    def validate_phone(self, value):
        return _validate_10_digit_phone(value)


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    email = serializers.EmailField(max_length=254)
    phone = serializers.CharField(max_length=40)
    password = serializers.CharField(max_length=128, min_length=6)

    def validate_name(self, value):
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("Name is required.")
        return normalized

    def validate_phone(self, value):
        return _validate_10_digit_phone(value)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(max_length=128)


class PNRLookupSerializer(serializers.Serializer):
    booking_id = serializers.IntegerField(min_value=1)
    email = serializers.EmailField(max_length=254)


class EmployeeLoginSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(max_length=128)


class AircraftSerializer(serializers.Serializer):
    tail_number = serializers.CharField(max_length=50)
    manufacturer = serializers.CharField(max_length=100)
    model = serializers.CharField(max_length=100)
    total_capacity = serializers.IntegerField(min_value=1)
    manufacture_year = serializers.IntegerField(required=False, allow_null=True)


class CreateScheduleSerializer(serializers.Serializer):
    flight_number = serializers.CharField(max_length=20)
    origin_airport_code = serializers.CharField(max_length=3, min_length=3)
    destination_airport_code = serializers.CharField(max_length=3, min_length=3)
    base_duration_minutes = serializers.IntegerField(min_value=1)
    aircraft_id = serializers.IntegerField(min_value=1)
    departure_time = serializers.DateTimeField()
    arrival_time = serializers.DateTimeField()
    flight_status = serializers.CharField(max_length=50, default="Scheduled")

    def validate(self, attrs):
        from datetime import timedelta
        from django.utils import timezone
        departure = attrs.get("departure_time")
        arrival = attrs.get("arrival_time")
        now = timezone.now()

        if departure:
            dep = departure
            if dep.tzinfo is None:
                now = now.replace(tzinfo=None)
            if dep < now - timedelta(days=2):
                raise serializers.ValidationError("Departure time cannot be more than 2 days in the past.")

        if departure and arrival:
            if arrival < departure - timedelta(days=2):
                raise serializers.ValidationError("Arrival time cannot be more than 2 days before departure time.")
            if arrival > departure + timedelta(days=5):
                raise serializers.ValidationError("Arrival time cannot be more than 5 days after departure time.")

        return attrs


class UpdateBookingStatusSerializer(serializers.Serializer):
    status = serializers.CharField(max_length=50)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


