from django.db import DatabaseError
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .serializers import BookingLookupSerializer, FinalizeBookingSerializer
from .services import (
    ApiDomainError,
    fetch_bookings_by_user,
    fetch_schedules,
    fetch_seats_by_aircraft_id,
    fetch_tickets_by_schedule_id,
    finalize_booking,
)


def _error_response(message, status_code, error_code):
    return Response(
        {
            "detail": message,
            "error": error_code,
        },
        status=status_code,
    )


def _domain_error_response(error):
    return _error_response(error.message, error.status_code, error.error_code)


@api_view(["GET"])
def schedules_view(request):
    origin = (request.query_params.get("origin") or "").strip()
    destination = (request.query_params.get("destination") or "").strip()
    departure_date = (request.query_params.get("date") or "").strip()

    try:
        schedules = fetch_schedules(
            origin=origin or None,
            destination=destination or None,
            departure_date=departure_date or None,
        )
        return Response(schedules)
    except DatabaseError:
        return _error_response(
            "Unable to fetch flight schedules. Please try again.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
        )


@api_view(["GET"])
def seats_view(request):
    aircraft_id = (request.query_params.get("aircraft_id") or "").strip()
    if not aircraft_id:
        return _error_response(
            "Query parameter aircraft_id is required.",
            status.HTTP_400_BAD_REQUEST,
            "INVALID_REQUEST",
        )

    try:
        seats = fetch_seats_by_aircraft_id(int(aircraft_id))
        return Response(seats)
    except ValueError:
        return _error_response(
            "Query parameter aircraft_id must be an integer.",
            status.HTTP_400_BAD_REQUEST,
            "INVALID_REQUEST",
        )
    except DatabaseError:
        return _error_response(
            "Unable to fetch seat map. Please try again.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
        )


@api_view(["GET"])
def tickets_view(request):
    schedule_id = (request.query_params.get("schedule_id") or "").strip()
    if not schedule_id:
        return _error_response(
            "Query parameter schedule_id is required.",
            status.HTTP_400_BAD_REQUEST,
            "INVALID_REQUEST",
        )

    try:
        tickets = fetch_tickets_by_schedule_id(int(schedule_id))
        return Response(tickets)
    except ValueError:
        return _error_response(
            "Query parameter schedule_id must be an integer.",
            status.HTTP_400_BAD_REQUEST,
            "INVALID_REQUEST",
        )
    except DatabaseError:
        return _error_response(
            "Unable to fetch unavailable seats. Please try again.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
        )


@api_view(["GET"])
def bookings_view(request):
    serializer = BookingLookupSerializer(data=request.query_params)
    if not serializer.is_valid():
        return _error_response(
            "Please provide valid name, email, and phone values.",
            status.HTTP_400_BAD_REQUEST,
            "INVALID_REQUEST",
        )

    try:
        bookings = fetch_bookings_by_user(**serializer.validated_data)
        return Response(bookings)
    except DatabaseError:
        return _error_response(
            "Unable to fetch bookings. Please try again.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
        )


@api_view(["POST"])
def finalize_booking_view(request):
    serializer = FinalizeBookingSerializer(data=request.data)
    if not serializer.is_valid():
        return _error_response(
            "Booking payload is invalid. Please review passenger and seat data.",
            status.HTTP_400_BAD_REQUEST,
            "INVALID_REQUEST",
        )

    try:
        booking = finalize_booking(serializer.validated_data)
        return Response(booking, status=status.HTTP_201_CREATED)
    except ApiDomainError as error:
        return _domain_error_response(error)
    except DatabaseError:
        return _error_response(
            "Unable to complete booking. Please try again.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
        )
