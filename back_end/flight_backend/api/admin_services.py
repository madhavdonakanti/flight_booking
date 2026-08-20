import base64
import hashlib
import hmac
import json
import time
from decimal import Decimal
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.utils import timezone

from .models import (
    Aircraft,
    Booking,
    BookingPassenger,
    BookingProcessing,
    Employee,
    EmployeeRole,
    Flight,
    Role,
    Schedule,
    Seat,
    Ticket,
)
from .services import ApiDomainError, NotFoundError, UnauthorizedError


class ForbiddenError(ApiDomainError):
    status_code = 403
    error_code = "FORBIDDEN"
    default_message = "You do not have permission to perform this action."


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(encoded: str) -> bytes:
    padding = 4 - (len(encoded) % 4)
    if padding != 4:
        encoded += "=" * padding
    return base64.urlsafe_b64decode(encoded.encode("utf-8"))


def seed_default_employees(force: bool = False):
    import sys
    is_testing = "test" in sys.argv
    if not getattr(settings, "DEBUG", False) and not is_testing and not force:
        return

    admin_role, _ = Role.objects.get_or_create(
        role_name="Admin",
        defaults={"description": "Full system, fleet, and schedule administrator"},
    )
    staff_role, _ = Role.objects.get_or_create(
        role_name="Staff",
        defaults={"description": "Customer booking and passenger support agent"},
    )

    admin_emp = Employee.objects.filter(email__iexact="admin@skyway.com").first()
    if not admin_emp:
        admin_emp = Employee.objects.create(
            first_name="System",
            last_name="Administrator",
            email="admin@skyway.com",
            password_hash=make_password("admin123"),
            hire_date=timezone.now().date(),
        )
    elif not admin_emp.password_hash:
        admin_emp.password_hash = make_password("admin123")
        admin_emp.save()

    EmployeeRole.objects.get_or_create(employee=admin_emp, role=admin_role)

    staff_emp = Employee.objects.filter(email__iexact="staff@skyway.com").first()
    if not staff_emp:
        staff_emp = Employee.objects.create(
            first_name="Ticketing",
            last_name="Staff",
            email="staff@skyway.com",
            password_hash=make_password("staff123"),
            hire_date=timezone.now().date(),
        )
    elif not staff_emp.password_hash:
        staff_emp.password_hash = make_password("staff123")
        staff_emp.save()

    EmployeeRole.objects.get_or_create(employee=staff_emp, role=staff_role)


def generate_employee_jwt_token(employee_id: int, email: str, roles: list) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "employee_id": employee_id,
        "email": email.lower(),
        "roles": roles,
        "token_type": "employee",
        "is_employee": True,
        "exp": int(time.time()) + (28800),  # 8 hours for staff/admin session
    }

    header_json = json.dumps(header, separators=(",", ":")).encode("utf-8")
    payload_json = json.dumps(payload, separators=(",", ":")).encode("utf-8")

    header_b64 = _b64url_encode(header_json)
    payload_b64 = _b64url_encode(payload_json)

    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    secret = str(settings.SECRET_KEY).encode("utf-8")
    signature = hmac.new(secret, signing_input, hashlib.sha256).digest()
    signature_b64 = _b64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{signature_b64}"


def verify_employee_jwt_token(token: str, required_role: str = None) -> dict:
    if not token or not isinstance(token, str):
        raise UnauthorizedError("Authentication token is required.")

    parts = token.strip().split(".")
    if len(parts) != 3:
        raise UnauthorizedError("Invalid authentication token format.")

    header_b64, payload_b64, signature_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode("utf-8")
    secret = str(settings.SECRET_KEY).encode("utf-8")
    expected_sig = _b64url_encode(hmac.new(secret, signing_input, hashlib.sha256).digest())

    if not hmac.compare_digest(signature_b64, expected_sig):
        raise UnauthorizedError("Authentication token signature is invalid.")

    try:
        payload_bytes = _b64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))
    except Exception:
        raise UnauthorizedError("Malformed authentication token payload.")

    exp = payload.get("exp")
    if exp and int(exp) < int(time.time()):
        raise UnauthorizedError("Session expired. Please log in again.")

    if payload.get("token_type") != "employee" and not payload.get("is_employee"):
        raise UnauthorizedError("Token does not belong to an authorized employee account.")

    roles = payload.get("roles", [])
    if required_role and required_role not in roles:
        raise ForbiddenError(f"Action requires '{required_role}' privileges.")

    return payload


def authenticate_employee(email: str, password: str) -> dict:
    import sys
    if getattr(settings, "DEBUG", False) or "test" in sys.argv:
        seed_default_employees()
    normalized_email = email.strip().lower()

    emp = Employee.objects.filter(email__iexact=normalized_email).first()
    if not emp or not emp.password_hash:
        raise UnauthorizedError("Invalid employee credentials.")

    if not check_password(password, emp.password_hash):
        raise UnauthorizedError("Invalid employee credentials.")

    roles = list(
        EmployeeRole.objects.filter(employee=emp).values_list("role__role_name", flat=True)
    )

    token = generate_employee_jwt_token(emp.employee_id, emp.email, roles)
    return {
        "token": token,
        "employee": {
            "employee_id": emp.employee_id,
            "name": f"{emp.first_name} {emp.last_name}".strip(),
            "email": emp.email,
            "roles": roles,
        },
    }


def fetch_all_aircraft():
    aircraft = Aircraft.objects.all().order_by("aircraft_id")
    return [
        {
            "aircraft_id": a.aircraft_id,
            "tail_number": a.tail_number,
            "manufacturer": a.manufacturer,
            "model": a.model,
            "total_capacity": a.total_capacity,
            "manufacture_year": a.manufacture_year,
            "total_seats_created": a.seats.count(),
        }
        for a in aircraft
    ]


def create_aircraft(payload: dict):
    with transaction.atomic():
        aircraft = Aircraft.objects.create(
            tail_number=payload["tail_number"].strip().upper(),
            manufacturer=payload["manufacturer"].strip(),
            model=payload["model"].strip(),
            total_capacity=payload["total_capacity"],
            manufacture_year=payload.get("manufacture_year"),
        )

        letters = ["A", "B", "C", "D", "E", "F"]
        capacity = payload["total_capacity"]
        rows = (capacity + 5) // 6

        seats_created = 0
        for row in range(1, rows + 1):
            for col_idx, letter in enumerate(letters):
                if seats_created >= capacity:
                    break
                seat_class = "business" if row <= 3 else "economy"
                Seat.objects.create(
                    aircraft=aircraft,
                    seat_number=f"{row}{letter}",
                    seat_class=seat_class,
                )
                seats_created += 1

        return {
            "aircraft_id": aircraft.aircraft_id,
            "tail_number": aircraft.tail_number,
            "manufacturer": aircraft.manufacturer,
            "model": aircraft.model,
            "total_capacity": aircraft.total_capacity,
            "manufacture_year": aircraft.manufacture_year,
        }


def delete_aircraft(aircraft_id: int):
    try:
        with transaction.atomic():
            aircraft = Aircraft.objects.get(aircraft_id=aircraft_id)
            schedules = list(aircraft.schedules.all())
            for s in schedules:
                delete_schedule_admin(s.schedule_id)
            aircraft.seats.all().delete()
            aircraft.delete()
            return {"message": "Aircraft deleted successfully."}
    except Aircraft.DoesNotExist:
        raise NotFoundError("Aircraft not found.")
    except Exception as error:
        raise ApiDomainError(f"Unable to delete aircraft: {str(error)}")


def fetch_all_schedules_admin():
    schedules = Schedule.objects.select_related("flight", "aircraft").all().order_by("-departure_time")
    results = []
    for s in schedules:
        flight = s.flight
        aircraft = s.aircraft
        results.append(
            {
                "schedule_id": s.schedule_id,
                "flight_id": flight.flight_id if flight else None,
                "flight_number": flight.flight_number if flight else "",
                "origin_airport_code": flight.origin_airport_code if flight else "",
                "destination_airport_code": flight.destination_airport_code if flight else "",
                "base_duration_minutes": flight.base_duration_minutes if flight else 0,
                "aircraft_id": s.aircraft_id,
                "aircraft_model": aircraft.model if aircraft else "",
                "tail_number": aircraft.tail_number if aircraft else "",
                "departure_time": s.departure_time.isoformat() if s.departure_time else None,
                "arrival_time": s.arrival_time.isoformat() if s.arrival_time else None,
                "flight_status": s.flight_status,
                "tickets_booked": s.tickets.count(),
            }
        )
    return results


def create_schedule_admin(payload: dict):
    from datetime import timedelta
    flight_number = payload["flight_number"].strip().upper()
    origin = payload["origin_airport_code"].strip().upper()
    destination = payload["destination_airport_code"].strip().upper()
    duration = payload["base_duration_minutes"]
    aircraft_id = payload["aircraft_id"]
    departure_time = payload["departure_time"]
    arrival_time = payload["arrival_time"]

    from datetime import datetime
    if isinstance(departure_time, str):
        departure_time = datetime.fromisoformat(departure_time)
    if isinstance(arrival_time, str):
        arrival_time = datetime.fromisoformat(arrival_time)

    now = timezone.now()
    dep = departure_time
    if dep.tzinfo is None:
        now = now.replace(tzinfo=None)
    if dep < now - timedelta(days=2):
        raise ApiDomainError("Departure time cannot be more than 2 days in the past.")

    if arrival_time < departure_time - timedelta(days=2):
        raise ApiDomainError("Arrival time cannot be more than 2 days before departure time.")
    if arrival_time > departure_time + timedelta(days=5):
        raise ApiDomainError("Arrival time cannot be more than 5 days after departure time.")

    try:
        aircraft = Aircraft.objects.get(aircraft_id=aircraft_id)
    except Aircraft.DoesNotExist:
        raise NotFoundError("Selected aircraft does not exist.")

    flight, _ = Flight.objects.get_or_create(
        flight_number=flight_number,
        defaults={
            "origin_airport_code": origin,
            "destination_airport_code": destination,
            "base_duration_minutes": duration,
        },
    )

    schedule = Schedule.objects.create(
        flight=flight,
        aircraft=aircraft,
        departure_time=payload["departure_time"],
        arrival_time=payload["arrival_time"],
        flight_status=payload.get("flight_status", "Scheduled"),
    )

    return {
        "schedule_id": schedule.schedule_id,
        "flight_number": flight.flight_number,
        "origin_airport_code": flight.origin_airport_code,
        "destination_airport_code": flight.destination_airport_code,
        "aircraft_model": aircraft.model,
        "departure_time": schedule.departure_time.isoformat(),
        "arrival_time": schedule.arrival_time.isoformat(),
        "flight_status": schedule.flight_status,
    }


def delete_schedule_admin(schedule_id: int):
    try:
        with transaction.atomic():
            schedule = Schedule.objects.get(schedule_id=schedule_id)
            tickets = list(schedule.tickets.select_related("booking").all())
            booking_ids = set(t.booking_id for t in tickets)

            schedule.tickets.all().delete()
            schedule.delete()

            if booking_ids:
                Booking.objects.filter(booking_id__in=booking_ids, tickets__isnull=True).update(booking_status="Cancelled")

            return {"message": "Schedule deleted successfully."}
    except Schedule.DoesNotExist:
        raise NotFoundError("Schedule not found.")
    except Exception as error:
        raise ApiDomainError(f"Unable to delete schedule: {str(error)}")


def fetch_all_bookings_admin():
    bookings = (
        Booking.objects.select_related("user")
        .prefetch_related("tickets__seat", "tickets__schedule__flight", "booking_passengers__passenger")
        .all()
        .order_by("-booking_date")
    )

    results = []
    for b in bookings:
        seats = [t.seat.seat_number for t in b.tickets.all() if t.seat and t.seat.seat_number]
        seats.sort()

        passengers = [
            {
                "passenger_id": bp.passenger.passenger_id,
                "name": f"{bp.passenger.first_name} {bp.passenger.last_name}".strip(),
                "passport_number": bp.passenger.passport_number or "N/A",
                "date_of_birth": bp.passenger.date_of_birth.isoformat() if bp.passenger.date_of_birth else None,
            }
            for bp in b.booking_passengers.all()
        ]

        first_ticket = b.tickets.first()
        route_code = ""
        flight_number = ""
        if first_ticket and first_ticket.schedule and first_ticket.schedule.flight:
            f = first_ticket.schedule.flight
            route_code = f"{f.origin_airport_code}-{f.destination_airport_code}"
            flight_number = f.flight_number

        results.append(
            {
                "booking_id": b.booking_id,
                "user_id": b.user.user_id if b.user else None,
                "user_name": f"{b.user.first_name} {b.user.last_name}".strip() if b.user else "Guest",
                "user_email": b.user.email if b.user else "",
                "user_phone": b.user.phone_number if b.user else "",
                "booking_date": b.booking_date.isoformat() if b.booking_date else None,
                "total_price": float(b.total_price) if b.total_price is not None else 0.0,
                "status": b.booking_status,
                "flight_number": flight_number,
                "route_code": route_code,
                "seats": seats,
                "passengers": passengers,
            }
        )

    return results


def update_booking_status_admin(employee_id: int, booking_id: int, status: str, notes: str = ""):
    try:
        booking = Booking.objects.get(booking_id=booking_id)
    except Booking.DoesNotExist:
        raise NotFoundError("Booking not found.")

    try:
        employee = Employee.objects.get(employee_id=employee_id)
    except Employee.DoesNotExist:
        raise NotFoundError("Employee not found.")

    old_status = booking.booking_status
    booking.booking_status = status.capitalize()
    booking.save()

    action_type = "CANCELLED" if status.lower() == "cancelled" else "MODIFIED"
    log_notes = notes or f"Booking status changed from {old_status} to {booking.booking_status}"

    BookingProcessing.objects.create(
        employee=employee,
        booking=booking,
        action_timestamp=timezone.now(),
        action_type=action_type,
        notes=log_notes,
    )

    return {
        "booking_id": booking.booking_id,
        "status": booking.booking_status,
        "action_type": action_type,
        "notes": log_notes,
    }


def fetch_audit_logs():
    logs = (
        BookingProcessing.objects.select_related("employee", "booking")
        .all()
        .order_by("-action_timestamp")
    )
    return [
        {
            "log_id": f"{l.employee_id}-{l.booking_id}-{int(l.action_timestamp.timestamp())}",
            "employee_id": l.employee_id,
            "employee_name": f"{l.employee.first_name} {l.employee.last_name}".strip() if l.employee else "Unknown",
            "employee_email": l.employee.email if l.employee else "",
            "booking_id": l.booking_id,
            "action_timestamp": l.action_timestamp.isoformat(),
            "action_type": l.action_type,
            "notes": l.notes or "",
        }
        for l in logs
    ]
