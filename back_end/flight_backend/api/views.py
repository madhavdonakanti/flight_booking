from django.db import DatabaseError
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .serializers import (
    BookingLookupSerializer,
    FinalizeBookingSerializer,
    LoginSerializer,
    PNRLookupSerializer,
    RegisterSerializer,
)
from .services import (
    ApiDomainError,
    UnauthorizedError,
    authenticate_user,
    fetch_booking_by_pnr,
    fetch_bookings_by_user,
    fetch_bookings_by_user_id,
    fetch_schedules,
    fetch_seats_by_aircraft_id,
    fetch_tickets_by_schedule_id,
    finalize_booking,
    register_user,
    verify_jwt_token,
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


def _extract_bearer_token(request):
    auth_header = request.headers.get("Authorization") or request.META.get("HTTP_AUTHORIZATION") or ""
    if not auth_header:
        raise UnauthorizedError("Authorization header is missing.")

    parts = auth_header.strip().split()
    if len(parts) != 2 or parts[0].lower() not in ("bearer", "token"):
        raise UnauthorizedError("Authorization header must be in format 'Bearer <token>'.")

    return parts[1]


@api_view(["POST"])
def register_view(request):
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return _error_response(
            "Registration data is invalid. Please check fields and password length.",
            status.HTTP_400_BAD_REQUEST,
            "INVALID_REQUEST",
        )

    try:
        data = register_user(**serializer.validated_data)
        return Response(data, status=status.HTTP_201_CREATED)
    except ApiDomainError as error:
        return _domain_error_response(error)
    except DatabaseError:
        return _error_response(
            "Unable to register user. Please try again.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
        )


@api_view(["POST"])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return _error_response(
            "Please provide email and password.",
            status.HTTP_400_BAD_REQUEST,
            "INVALID_REQUEST",
        )

    try:
        data = authenticate_user(**serializer.validated_data)
        return Response(data, status=status.HTTP_200_OK)
    except ApiDomainError as error:
        return _domain_error_response(error)
    except DatabaseError:
        return _error_response(
            "Unable to authenticate user. Please try again.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
        )


@api_view(["GET"])
def me_view(request):
    try:
        token = _extract_bearer_token(request)
        payload = verify_jwt_token(token)
        return Response({"user": payload})
    except ApiDomainError as error:
        return _domain_error_response(error)


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


@api_view(["GET"])
def pnr_lookup_view(request):
    serializer = PNRLookupSerializer(data=request.query_params)
    if not serializer.is_valid():
        return _error_response(
            "Please provide a valid Booking ID and Email.",
            status.HTTP_400_BAD_REQUEST,
            "INVALID_REQUEST",
        )

    try:
        booking = fetch_booking_by_pnr(**serializer.validated_data)
        return Response([booking])
    except ApiDomainError as error:
        return _domain_error_response(error)
    except DatabaseError:
        return _error_response(
            "Unable to lookup booking. Please try again.",
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "DATABASE_ERROR",
        )


@api_view(["GET"])
def my_bookings_view(request):
    try:
        token = _extract_bearer_token(request)
        payload = verify_jwt_token(token)
        user_id = payload.get("user_id")
        bookings = fetch_bookings_by_user_id(user_id)
        return Response(bookings)
    except ApiDomainError as error:
        return _domain_error_response(error)
    except DatabaseError:
        return _error_response(
            "Unable to fetch user bookings. Please try again.",
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


from .admin_services import (
    authenticate_employee,
    create_aircraft,
    create_schedule_admin,
    delete_aircraft,
    delete_schedule_admin,
    fetch_all_aircraft,
    fetch_all_bookings_admin,
    fetch_all_schedules_admin,
    fetch_audit_logs,
    update_booking_status_admin,
    verify_employee_jwt_token,
)
from .serializers import (
    AircraftSerializer,
    CreateScheduleSerializer,
    EmployeeLoginSerializer,
    UpdateBookingStatusSerializer,
)


@api_view(["POST"])
def admin_login_view(request):
    serializer = EmployeeLoginSerializer(data=request.data)
    if not serializer.is_valid():
        return _error_response("Email and password are required.", status.HTTP_400_BAD_REQUEST, "INVALID_REQUEST")

    try:
        data = authenticate_employee(**serializer.validated_data)
        return Response(data, status=status.HTTP_200_OK)
    except ApiDomainError as error:
        return _domain_error_response(error)


@api_view(["GET"])
def admin_me_view(request):
    try:
        token = _extract_bearer_token(request)
        payload = verify_employee_jwt_token(token)
        return Response({"employee": payload})
    except ApiDomainError as error:
        return _domain_error_response(error)


@api_view(["GET", "POST"])
def admin_aircraft_view(request):
    try:
        token = _extract_bearer_token(request)
        if request.method == "GET":
            verify_employee_jwt_token(token)
            return Response(fetch_all_aircraft())

        if request.method == "POST":
            verify_employee_jwt_token(token, required_role="Admin")
            serializer = AircraftSerializer(data=request.data)
            if not serializer.is_valid():
                return _error_response("Invalid aircraft payload.", status.HTTP_400_BAD_REQUEST, "INVALID_REQUEST")
            aircraft = create_aircraft(serializer.validated_data)
            return Response(aircraft, status=status.HTTP_201_CREATED)
    except ApiDomainError as error:
        return _domain_error_response(error)


@api_view(["DELETE"])
def admin_aircraft_detail_view(request, aircraft_id):
    try:
        token = _extract_bearer_token(request)
        verify_employee_jwt_token(token, required_role="Admin")
        res = delete_aircraft(aircraft_id)
        return Response(res, status=status.HTTP_200_OK)
    except ApiDomainError as error:
        return _domain_error_response(error)


@api_view(["GET", "POST"])
def admin_schedules_view(request):
    try:
        token = _extract_bearer_token(request)
        if request.method == "GET":
            verify_employee_jwt_token(token)
            return Response(fetch_all_schedules_admin())

        if request.method == "POST":
            verify_employee_jwt_token(token, required_role="Admin")
            serializer = CreateScheduleSerializer(data=request.data)
            if not serializer.is_valid():
                return _error_response("Invalid schedule payload.", status.HTTP_400_BAD_REQUEST, "INVALID_REQUEST")
            schedule = create_schedule_admin(serializer.validated_data)
            return Response(schedule, status=status.HTTP_201_CREATED)
    except ApiDomainError as error:
        return _domain_error_response(error)


@api_view(["DELETE"])
def admin_schedule_detail_view(request, schedule_id):
    try:
        token = _extract_bearer_token(request)
        verify_employee_jwt_token(token, required_role="Admin")
        res = delete_schedule_admin(schedule_id)
        return Response(res, status=status.HTTP_200_OK)
    except ApiDomainError as error:
        return _domain_error_response(error)


@api_view(["GET"])
def admin_bookings_view(request):
    try:
        token = _extract_bearer_token(request)
        verify_employee_jwt_token(token)
        return Response(fetch_all_bookings_admin())
    except ApiDomainError as error:
        return _domain_error_response(error)


@api_view(["PUT"])
def admin_booking_update_view(request, booking_id):
    try:
        token = _extract_bearer_token(request)
        payload = verify_employee_jwt_token(token)
        serializer = UpdateBookingStatusSerializer(data=request.data)
        if not serializer.is_valid():
            return _error_response("Invalid status payload.", status.HTTP_400_BAD_REQUEST, "INVALID_REQUEST")

        res = update_booking_status_admin(
            employee_id=payload["employee_id"],
            booking_id=booking_id,
            status=serializer.validated_data["status"],
            notes=serializer.validated_data.get("notes", ""),
        )
        return Response(res, status=status.HTTP_200_OK)
    except ApiDomainError as error:
        return _domain_error_response(error)


@api_view(["GET"])
def admin_audit_logs_view(request):
    try:
        token = _extract_bearer_token(request)
        verify_employee_jwt_token(token)
        return Response(fetch_audit_logs())
    except ApiDomainError as error:
        return _domain_error_response(error)


