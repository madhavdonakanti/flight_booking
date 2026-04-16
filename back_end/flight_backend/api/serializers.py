from rest_framework import serializers


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
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("Phone is required.")
        return normalized


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
        normalized = value.strip()
        if not normalized:
            raise serializers.ValidationError("Phone is required.")
        return normalized
