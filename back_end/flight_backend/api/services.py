import base64
import hashlib
import hmac
import json
import re
import time
from decimal import Decimal
from typing import Any
from uuid import uuid4

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import (
    Aircraft,
    Booking,
    BookingPassenger,
    Flight,
    Passenger,
    Payment,
    Schedule,
    Seat,
    Ticket,
    User,
)

BUSINESS_FARE = Decimal("500")
ECONOMY_FARE = Decimal("150")


class ApiDomainError(Exception):
    status_code = 400
    error_code = "BAD_REQUEST"
    default_message = "Request could not be processed."

    def __init__(self, message=None):
        super().__init__(message or self.default_message)
        self.message = message or self.default_message


class NotFoundError(ApiDomainError):
    status_code = 404
    error_code = "NOT_FOUND"
    default_message = "Resource not found."


class RequestValidationError(ApiDomainError):
    status_code = 400
    error_code = "INVALID_REQUEST"
    default_message = "Request data is invalid."


class UnauthorizedError(ApiDomainError):
    status_code = 401
    error_code = "UNAUTHORIZED"
    default_message = "Authentication token is missing or invalid."


class SeatConflictError(ApiDomainError):
    status_code = 409
    error_code = "SEAT_TAKEN"
    default_message = "One of the selected seats is no longer available."


class PaymentFailedError(ApiDomainError):
    status_code = 402
    error_code = "PAYMENT_FAILED"
    default_message = "Payment could not be completed."


def _normalize_status(raw_status):
    if isinstance(raw_status, str) and raw_status.strip():
        return raw_status.strip().lower()
    return "confirmed"


def _normalize_seat_class(raw_seat_class):
    if not isinstance(raw_seat_class, str):
        return "economy"

    lowered = raw_seat_class.strip().lower()
    if "business" in lowered or "first" in lowered:
        return "business"
    return "economy"


def _seat_fare(raw_seat_class):
    if _normalize_seat_class(raw_seat_class) == "business":
        return BUSINESS_FARE
    return ECONOMY_FARE


def _split_name(name):
    normalized = (name or "").strip()
    if not normalized:
        return "Guest", "User"

    parts = normalized.split()
    if len(parts) == 1:
        return parts[0], "Customer"

    return parts[0], " ".join(parts[1:])


def fetch_schedules(origin=None, destination=None, departure_date=None):
    qs = Schedule.objects.select_related("flight", "aircraft").all()

    if origin:
        qs = qs.filter(flight__origin_airport_code__iexact=origin)

    if destination:
        qs = qs.filter(flight__destination_airport_code__iexact=destination)

    if departure_date:
        qs = qs.filter(departure_time__date=departure_date)

    qs = qs.order_by("departure_time")

    results = []
    for s in qs:
        origin_code = s.flight.origin_airport_code if s.flight else ""
        dest_code = s.flight.destination_airport_code if s.flight else ""
        route_code = f"{origin_code}-{dest_code}"
        aircraft_model = s.aircraft.model if s.aircraft else None

        results.append(
            {
                "schedule_id": s.schedule_id,
                "departure_time": s.departure_time.isoformat() if s.departure_time else None,
                "arrival_time": s.arrival_time.isoformat() if s.arrival_time else None,
                "flight_id": s.flight_id,
                "aircraft_id": s.aircraft_id,
                "route_code": route_code,
                "flight": {"route_code": route_code},
                "aircraft": {
                    "aircraft_id": s.aircraft_id,
                    "model": aircraft_model,
                },
                "aircraft_model": aircraft_model,
            }
        )

    return results


def fetch_seats_by_aircraft_id(aircraft_id):
    seats = Seat.objects.filter(aircraft_id=aircraft_id).order_by("seat_number")
    return [
        {
            "seat_id": s.seat_id,
            "seat_number": s.seat_number,
            "seat_class": _normalize_seat_class(s.seat_class),
            "aircraft_id": s.aircraft_id,
        }
        for s in seats
    ]


def fetch_tickets_by_schedule_id(schedule_id):
    tickets = Ticket.objects.filter(schedule_id=schedule_id).order_by("ticket_id")
    return [
        {
            "ticket_id": t.ticket_id,
            "booking_id": t.booking_id,
            "passenger_id": t.passenger_id,
            "schedule_id": t.schedule_id,
            "seat_id": t.seat_id,
        }
        for t in tickets
    ]


def fetch_bookings_by_user(name, email, phone):
    user_email = email.strip().lower()
    user_phone_clean = re.sub(r"\D", "", phone or "")
    search_name = (name or "").strip().lower()

    users = User.objects.filter(email__iexact=user_email)
    matched_user = None

    for u in users:
        u_phone_clean = re.sub(r"\D", "", u.phone_number or "")
        if u_phone_clean == user_phone_clean:
            full_name = f"{u.first_name} {u.last_name}".strip().lower()
            if (
                search_name == full_name
                or search_name == u.first_name.strip().lower()
                or search_name == u.last_name.strip().lower()
            ):
                matched_user = u
                break

    if not matched_user:
        return []

    bookings = (
        Booking.objects.filter(user=matched_user)
        .prefetch_related("tickets__seat")
        .order_by("-booking_date")
    )

    results = []
    for b in bookings:
        seats = [
            t.seat.seat_number
            for t in b.tickets.all()
            if t.seat and t.seat.seat_number
        ]
        seats.sort()

        results.append(
            {
                "booking_id": b.booking_id,
                "booking_date": b.booking_date.isoformat() if b.booking_date else None,
                "total_amount": float(b.total_price) if b.total_price is not None else None,
                "status": _normalize_status(b.booking_status),
                "seats": seats,
            }
        )

    return results


def _map_integrity_error(error):
    lowered = str(error).lower()

    if "uq_ticket_seat_schedule" in lowered:
        return SeatConflictError("One of your selected seats was just booked by someone else.")

    if "aircraft capacity" in lowered or "capacity" in lowered:
        return SeatConflictError("No remaining seats are available for this schedule.")

    if "payment" in lowered:
        return PaymentFailedError("Payment authorization failed. Please try another card.")

    return RequestValidationError("Unable to complete booking due to a data constraint.")


def finalize_booking(payload):
    user_payload = payload["user"]
    passenger_payloads = payload["passengers"]
    schedule_id = int(payload["schedule_id"])
    ordered_assignments = sorted(
        payload["seat_assignments"], key=lambda assignment: assignment["passenger_index"]
    )
    seat_ids = [int(assignment["seat_id"]) for assignment in ordered_assignments]

    if len(passenger_payloads) != len(ordered_assignments):
        raise RequestValidationError("Passenger and seat assignment counts must match.")

    try:
        with transaction.atomic():
            try:
                schedule = (
                    Schedule.objects.select_related("flight", "aircraft").get(
                        schedule_id=schedule_id
                    )
                )
            except Schedule.DoesNotExist:
                raise NotFoundError("Selected schedule was not found.")

            if schedule.departure_time is not None:
                now = timezone.now()
                dep = schedule.departure_time
                if dep.tzinfo is None:
                    now = now.replace(tzinfo=None)
                if dep <= now:
                    raise RequestValidationError(
                        "This flight has already departed and can no longer be booked."
                    )

            seats = list(
                Seat.objects.filter(
                    aircraft_id=schedule.aircraft_id, seat_id__in=seat_ids
                ).select_for_update()
            )

            seat_by_id = {s.seat_id: s for s in seats}
            if len(seat_by_id) != len(set(seat_ids)):
                raise RequestValidationError(
                    "One or more selected seats are invalid for this aircraft."
                )

            taken_seats = Ticket.objects.filter(
                schedule_id=schedule_id, seat_id__in=seat_ids
            ).values_list("seat_id", flat=True)

            if taken_seats:
                raise SeatConflictError("One of your selected seats was just booked by someone else.")

            current_ticket_count = Ticket.objects.filter(schedule_id=schedule_id).count()
            max_capacity = schedule.aircraft.total_capacity if schedule.aircraft else 0
            if current_ticket_count + len(seat_ids) > max_capacity:
                raise SeatConflictError("No remaining seats are available for this schedule.")

            total_price = sum(
                (_seat_fare(seat_by_id[seat_id].seat_class) for seat_id in seat_ids),
                Decimal("0"),
            )

            if total_price <= 0:
                raise PaymentFailedError("Payment amount is invalid for this booking.")

            first_name, last_name = _split_name(user_payload["name"])
            email = user_payload["email"].strip().lower()
            phone = user_payload["phone"].strip()

            user = User.objects.filter(email=email).first()
            if user:
                user.first_name = first_name
                user.last_name = last_name
                user.phone_number = phone
                user.save()
            else:
                user = User.objects.create(
                    first_name=first_name,
                    last_name=last_name,
                    email=email,
                    phone_number=phone,
                    password_hash=make_password(None),
                    created_at=timezone.now(),
                )

            booking = Booking.objects.create(
                user=user,
                booking_date=timezone.now(),
                total_price=total_price,
                booking_status="Confirmed",
            )

            passenger_objects = []
            for passenger_payload in passenger_payloads:
                p_first = passenger_payload["first_name"].strip()
                p_last = passenger_payload["last_name"].strip()
                p_dob = passenger_payload["birth_date"]
                p_passport = passenger_payload.get("passport_number")
                if isinstance(p_dob, str):
                    from datetime import date
                    try:
                        p_dob = date.fromisoformat(p_dob)
                    except ValueError:
                        raise RequestValidationError("Passenger date of birth must be a valid YYYY-MM-DD date.")

                if p_dob > timezone.now().date():
                    raise RequestValidationError("Passenger date of birth cannot be in the future.")

                if p_passport:
                    passenger = Passenger.objects.filter(passport_number=p_passport).first()
                    if passenger:
                        passenger.first_name = p_first
                        passenger.last_name = p_last
                        passenger.date_of_birth = p_dob
                        passenger.save()
                    else:
                        passenger = Passenger.objects.create(
                            first_name=p_first,
                            last_name=p_last,
                            date_of_birth=p_dob,
                            passport_number=p_passport,
                        )
                else:
                    passenger = Passenger.objects.create(
                        first_name=p_first,
                        last_name=p_last,
                        date_of_birth=p_dob,
                    )

                passenger_objects.append(passenger)
                BookingPassenger.objects.get_or_create(booking=booking, passenger=passenger)

            seat_numbers = []
            for assignment in ordered_assignments:
                passenger_index = assignment["passenger_index"]
                seat_id = int(assignment["seat_id"])

                passenger = passenger_objects[passenger_index]
                seat = seat_by_id[seat_id]
                fare_paid = _seat_fare(seat.seat_class)
                boarding_group = "Group 1" if fare_paid == BUSINESS_FARE else "Group 3"
                ticket_number = f"FB-{booking.booking_id}-{passenger_index + 1}-{uuid4().hex[:8].upper()}"

                Ticket.objects.create(
                    booking=booking,
                    passenger=passenger,
                    schedule=schedule,
                    seat=seat,
                    aircraft=schedule.aircraft,
                    ticket_number=ticket_number,
                    fare_paid=fare_paid,
                    boarding_group=boarding_group,
                )

                seat_numbers.append(seat.seat_number)

            Payment.objects.create(
                booking=booking,
                amount=total_price,
                payment_date=timezone.now(),
                payment_method="Card",
                transaction_id=f"txn_{uuid4().hex}",
                payment_status="Completed",
            )

            origin = schedule.flight.origin_airport_code if schedule.flight else ""
            dest = schedule.flight.destination_airport_code if schedule.flight else ""
            route_code = f"{origin}-{dest}"

            return {
                "booking_id": booking.booking_id,
                "booking_date": booking.booking_date.isoformat(),
                "total_amount": float(total_price),
                "status": _normalize_status(booking.booking_status),
                "schedule_id": schedule_id,
                "route_code": route_code,
                "seats": seat_numbers,
                "user": {
                    "name": user_payload["name"],
                    "email": user_payload["email"],
                    "phone": user_payload["phone"],
                },
            }
    except IntegrityError as error:
        mapped_error = _map_integrity_error(error)
        raise mapped_error from error


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(encoded: str) -> bytes:
    padding = 4 - (len(encoded) % 4)
    if padding != 4:
        encoded += "=" * padding
    return base64.urlsafe_b64decode(encoded.encode("utf-8"))


def generate_jwt_token(user_id: int, email: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "user_id": user_id,
        "email": email.lower(),
        "token_type": "user",
        "exp": int(time.time()) + (7200),  # 2 hours token validity
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


def verify_jwt_token(token: str) -> dict:
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
        raise UnauthorizedError("Authentication token has expired. Please log in again.")

    if payload.get("token_type") != "user" or payload.get("is_employee"):
        raise UnauthorizedError("Token is not a valid user authentication token.")

    return payload


def register_user(name: str, email: str, phone: str, password: str) -> dict:
    normalized_email = email.strip().lower()
    first_name, last_name = _split_name(name)
    clean_phone = re.sub(r"\D", "", phone or "")

    if len(clean_phone) != 10:
        raise RequestValidationError("Phone number must contain exactly 10 digits.")

    if len(password) < 6:
        raise RequestValidationError("Password must be at least 6 characters long.")

    existing_user = User.objects.filter(email=normalized_email).first()

    if existing_user:
        # Check if existing user has an unusable password (guest account)
        if existing_user.password_hash and not existing_user.password_hash.startswith("guest-"):
            # Check if existing user has usable password
            try:
                if check_password(password, existing_user.password_hash):
                    token = generate_jwt_token(existing_user.user_id, existing_user.email)
                    return {
                        "token": token,
                        "user": {
                            "user_id": existing_user.user_id,
                            "name": f"{existing_user.first_name} {existing_user.last_name}".strip(),
                            "email": existing_user.email,
                            "phone": existing_user.phone_number or "",
                        },
                    }
            except Exception:
                pass
            raise RequestValidationError("An account with this email already exists.")

        # Claim guest account into full registered account
        existing_user.first_name = first_name
        existing_user.last_name = last_name
        existing_user.phone_number = clean_phone
        existing_user.password_hash = make_password(password)
        existing_user.save()
        user = existing_user
    else:
        user = User.objects.create(
            first_name=first_name,
            last_name=last_name,
            email=normalized_email,
            phone_number=clean_phone,
            password_hash=make_password(password),
            created_at=timezone.now(),
        )

    token = generate_jwt_token(user.user_id, user.email)
    return {
        "token": token,
        "user": {
            "user_id": user.user_id,
            "name": f"{user.first_name} {user.last_name}".strip(),
            "email": user.email,
            "phone": user.phone_number or "",
        },
    }


def authenticate_user(email: str, password: str) -> dict:
    normalized_email = email.strip().lower()
    user = User.objects.filter(email=normalized_email).first()

    if not user or not user.password_hash:
        raise RequestValidationError("Invalid email or password.")

    if not check_password(password, user.password_hash):
        raise RequestValidationError("Invalid email or password.")

    token = generate_jwt_token(user.user_id, user.email)
    return {
        "token": token,
        "user": {
            "user_id": user.user_id,
            "name": f"{user.first_name} {user.last_name}".strip(),
            "email": user.email,
            "phone": user.phone_number or "",
        },
    }


def fetch_booking_by_pnr(booking_id: int, email: str) -> dict:
    normalized_email = email.strip().lower()

    try:
        booking = (
            Booking.objects.filter(booking_id=booking_id)
            .select_related("user")
            .prefetch_related("tickets__seat")
            .get()
        )
    except Booking.DoesNotExist:
        raise NotFoundError("No booking matching that Booking ID and Email was found.")

    is_owner = booking.user and booking.user.email.strip().lower() == normalized_email

    if not is_owner:
        raise NotFoundError("No booking matching that Booking ID and Email was found.")

    seats = [
        t.seat.seat_number for t in booking.tickets.all() if t.seat and t.seat.seat_number
    ]
    seats.sort()

    first_ticket = booking.tickets.first()
    schedule_id = first_ticket.schedule_id if first_ticket else None
    route_code = ""
    if first_ticket and first_ticket.schedule and first_ticket.schedule.flight:
        f = first_ticket.schedule.flight
        route_code = f"{f.origin_airport_code}-{f.destination_airport_code}"

    return {
        "booking_id": booking.booking_id,
        "booking_date": booking.booking_date.isoformat() if booking.booking_date else None,
        "total_amount": float(booking.total_price) if booking.total_price is not None else None,
        "status": _normalize_status(booking.booking_status),
        "schedule_id": schedule_id,
        "route_code": route_code,
        "seats": seats,
        "user": {
            "name": f"{booking.user.first_name} {booking.user.last_name}".strip() if booking.user else "Guest",
            "email": booking.user.email if booking.user else normalized_email,
            "phone": booking.user.phone_number if booking.user else "",
        },
    }


def fetch_bookings_by_user_id(user_id: int) -> list:
    bookings = (
        Booking.objects.filter(user_id=user_id)
        .prefetch_related("tickets__seat", "tickets__schedule__flight")
        .order_by("-booking_date")
    )

    results = []
    for b in bookings:
        seats = [
            t.seat.seat_number
            for t in b.tickets.all()
            if t.seat and t.seat.seat_number
        ]
        seats.sort()

        first_ticket = b.tickets.first()
        schedule_id = first_ticket.schedule_id if first_ticket else None
        route_code = ""
        if first_ticket and first_ticket.schedule and first_ticket.schedule.flight:
            f = first_ticket.schedule.flight
            route_code = f"{f.origin_airport_code}-{f.destination_airport_code}"

        results.append(
            {
                "booking_id": b.booking_id,
                "booking_date": b.booking_date.isoformat() if b.booking_date else None,
                "total_amount": float(b.total_price) if b.total_price is not None else None,
                "status": _normalize_status(b.booking_status),
                "schedule_id": schedule_id,
                "route_code": route_code,
                "seats": seats,
            }
        )

    return results

