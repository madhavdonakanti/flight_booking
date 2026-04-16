from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import uuid4

from django.db import IntegrityError, connection, transaction
from django.utils import timezone

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


def _build_in_clause(values):
    normalized = [int(value) for value in values]
    placeholders = ", ".join(["%s"] * len(normalized))
    return placeholders, normalized


def fetch_schedules(origin=None, destination=None, departure_date=None):
    where_clauses = []
    params = []

    if origin:
        where_clauses.append("UPPER(f.origin_airport_code) = UPPER(%s)")
        params.append(origin)

    if destination:
        where_clauses.append("UPPER(f.destination_airport_code) = UPPER(%s)")
        params.append(destination)

    if departure_date:
        where_clauses.append("DATE(s.departure_time) = DATE(%s)")
        params.append(departure_date)

    where_sql = ""
    if where_clauses:
        where_sql = "WHERE " + " AND ".join(where_clauses)

    query = f"""
        SELECT
            s.schedule_id,
            s.departure_time,
            s.arrival_time,
            s.flight_id,
            s.aircraft_id,
            f.origin_airport_code,
            f.destination_airport_code,
            a.model AS aircraft_model
        FROM SCHEDULE s
        JOIN FLIGHT f ON f.flight_id = s.flight_id
        LEFT JOIN AIRCRAFT a ON a.aircraft_id = s.aircraft_id
        {where_sql}
        ORDER BY s.departure_time ASC
    """

    with connection.cursor() as cursor:
        cursor.execute(query, params)
        rows = cursor.fetchall()

    results = []
    for row in rows:
        route_code = f"{row[5]}-{row[6]}"
        results.append(
            {
                "schedule_id": row[0],
                "departure_time": row[1].isoformat() if row[1] else None,
                "arrival_time": row[2].isoformat() if row[2] else None,
                "flight_id": row[3],
                "aircraft_id": row[4],
                "route_code": route_code,
                "flight": {"route_code": route_code},
                "aircraft": {
                    "aircraft_id": row[4],
                    "model": row[7],
                },
                "aircraft_model": row[7],
            }
        )

    return results


def fetch_seats_by_aircraft_id(aircraft_id):
    query = """
        SELECT seat_id, seat_number, seat_class, aircraft_id
        FROM SEAT
        WHERE aircraft_id = %s
        ORDER BY seat_number ASC
    """

    with connection.cursor() as cursor:
        cursor.execute(query, [aircraft_id])
        rows = cursor.fetchall()

    return [
        {
            "seat_id": row[0],
            "seat_number": row[1],
            "seat_class": _normalize_seat_class(row[2]),
            "aircraft_id": row[3],
        }
        for row in rows
    ]


def fetch_tickets_by_schedule_id(schedule_id):
    query = """
        SELECT ticket_id, booking_id, passenger_id, schedule_id, seat_id
        FROM TICKET
        WHERE schedule_id = %s
        ORDER BY ticket_id ASC
    """

    with connection.cursor() as cursor:
        cursor.execute(query, [schedule_id])
        rows = cursor.fetchall()

    return [
        {
            "ticket_id": row[0],
            "booking_id": row[1],
            "passenger_id": row[2],
            "schedule_id": row[3],
            "seat_id": row[4],
        }
        for row in rows
    ]


def fetch_bookings_by_user(name, email, phone):
    query = """
        SELECT
            b.booking_id,
            b.booking_date,
            b.total_price,
            b.booking_status,
            COALESCE(
                ARRAY_AGG(s.seat_number ORDER BY s.seat_number)
                FILTER (WHERE s.seat_number IS NOT NULL),
                ARRAY[]::VARCHAR[]
            ) AS seats
        FROM BOOKING b
        JOIN "USER" u ON u.user_id = b.user_id
        LEFT JOIN TICKET t ON t.booking_id = b.booking_id
        LEFT JOIN SEAT s ON s.seat_id = t.seat_id
        WHERE LOWER(u.email) = LOWER(%s)
          AND regexp_replace(COALESCE(u.phone_number, ''), '\\D', '', 'g')
              = regexp_replace(%s, '\\D', '', 'g')
          AND (
                LOWER(TRIM(u.first_name || ' ' || u.last_name)) = LOWER(TRIM(%s))
                OR LOWER(TRIM(u.first_name)) = LOWER(TRIM(%s))
                OR LOWER(TRIM(u.last_name)) = LOWER(TRIM(%s))
              )
        GROUP BY b.booking_id, b.booking_date, b.total_price, b.booking_status
        ORDER BY b.booking_date DESC
    """

    with connection.cursor() as cursor:
        cursor.execute(query, [email, phone, name, name, name])
        rows = cursor.fetchall()

    return [
        {
            "booking_id": row[0],
            "booking_date": row[1].isoformat() if row[1] else None,
            "total_amount": float(row[2]) if row[2] is not None else None,
            "status": _normalize_status(row[3]),
            "seats": list(row[4]) if row[4] else [],
        }
        for row in rows
    ]


def _fetch_schedule_for_update(cursor, schedule_id):
    cursor.execute(
        """
        SELECT
            s.schedule_id,
            s.aircraft_id,
            s.departure_time,
            f.origin_airport_code,
            f.destination_airport_code
        FROM SCHEDULE s
        JOIN FLIGHT f ON f.flight_id = s.flight_id
        WHERE s.schedule_id = %s
        FOR UPDATE
        """,
        [schedule_id],
    )
    row = cursor.fetchone()
    if not row:
        raise NotFoundError("Selected schedule was not found.")

    return {
        "schedule_id": row[0],
        "aircraft_id": row[1],
        "departure_time": row[2],
        "route_code": f"{row[3]}-{row[4]}",
    }


def _fetch_seat_rows_for_update(cursor, aircraft_id, seat_ids):
    placeholders, normalized_seat_ids = _build_in_clause(seat_ids)
    query = f"""
        SELECT seat_id, seat_number, seat_class
        FROM SEAT
        WHERE aircraft_id = %s
          AND seat_id IN ({placeholders})
        FOR UPDATE
    """

    cursor.execute(query, [aircraft_id, *normalized_seat_ids])
    rows = cursor.fetchall()

    return {
        int(row[0]): {
            "seat_id": int(row[0]),
            "seat_number": row[1],
            "seat_class": row[2],
        }
        for row in rows
    }


def _ensure_seats_available(cursor, schedule_id, seat_ids):
    placeholders, normalized_seat_ids = _build_in_clause(seat_ids)
    query = f"""
        SELECT seat_id
        FROM TICKET
        WHERE schedule_id = %s
          AND seat_id IN ({placeholders})
    """

    cursor.execute(query, [schedule_id, *normalized_seat_ids])
    taken = [row[0] for row in cursor.fetchall()]
    if taken:
        raise SeatConflictError("One of your selected seats was just booked by someone else.")


def _upsert_user(cursor, user_payload):
    first_name, last_name = _split_name(user_payload["name"])
    email = user_payload["email"].strip().lower()
    phone = user_payload["phone"].strip()

    cursor.execute(
        """
        INSERT INTO "USER" (
            first_name,
            last_name,
            email,
            phone_number,
            password_hash,
            created_at
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (email)
        DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            phone_number = EXCLUDED.phone_number
        RETURNING user_id
        """,
        [
            first_name,
            last_name,
            email,
            phone,
            "guest-account",
            timezone.now(),
        ],
    )
    return cursor.fetchone()[0]


def _insert_booking(cursor, user_id, total_price):
    cursor.execute(
        """
        INSERT INTO BOOKING (user_id, booking_date, total_price, booking_status)
        VALUES (%s, %s, %s, %s)
        RETURNING booking_id, booking_date, booking_status
        """,
        [user_id, timezone.now(), total_price, "Confirmed"],
    )
    row = cursor.fetchone()
    return {
        "booking_id": row[0],
        "booking_date": row[1],
        "booking_status": row[2],
    }


def _upsert_passenger(cursor, passenger_payload):
    first_name = passenger_payload["first_name"].strip()
    last_name = passenger_payload["last_name"].strip()
    birth_date = passenger_payload["birth_date"]
    passport_number = passenger_payload.get("passport_number")

    if passport_number:
        cursor.execute(
            """
            INSERT INTO PASSENGER (
                first_name,
                last_name,
                date_of_birth,
                passport_number,
                nationality
            )
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (passport_number)
            DO UPDATE SET
                first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                date_of_birth = EXCLUDED.date_of_birth
            RETURNING passenger_id
            """,
            [
                first_name,
                last_name,
                birth_date,
                passport_number,
                None,
            ],
        )
    else:
        cursor.execute(
            """
            INSERT INTO PASSENGER (
                first_name,
                last_name,
                date_of_birth,
                passport_number,
                nationality
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING passenger_id
            """,
            [
                first_name,
                last_name,
                birth_date,
                None,
                None,
            ],
        )

    return cursor.fetchone()[0]


def _link_booking_passenger(cursor, booking_id, passenger_id):
    cursor.execute(
        """
        INSERT INTO BOOKING_PASSENGER (booking_id, passenger_id, special_requests)
        VALUES (%s, %s, %s)
        ON CONFLICT (booking_id, passenger_id)
        DO NOTHING
        """,
        [booking_id, passenger_id, None],
    )


def _insert_ticket(
    cursor,
    booking_id,
    passenger_id,
    schedule_id,
    seat_id,
    aircraft_id,
    fare_paid,
    passenger_index,
):
    boarding_group = "Group 1" if fare_paid == BUSINESS_FARE else "Group 3"
    ticket_number = f"FB-{booking_id}-{passenger_index + 1}-{uuid4().hex[:8].upper()}"

    cursor.execute(
        """
        INSERT INTO TICKET (
            booking_id,
            passenger_id,
            schedule_id,
            seat_id,
            aircraft_id,
            ticket_number,
            fare_paid,
            boarding_group
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING ticket_id
        """,
        [
            booking_id,
            passenger_id,
            schedule_id,
            seat_id,
            aircraft_id,
            ticket_number,
            fare_paid,
            boarding_group,
        ],
    )

    return cursor.fetchone()[0]


def _insert_payment(cursor, booking_id, total_price):
    cursor.execute(
        """
        INSERT INTO PAYMENT (
            booking_id,
            amount,
            payment_date,
            payment_method,
            transaction_id,
            payment_status
        )
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING payment_id
        """,
        [
            booking_id,
            total_price,
            timezone.now(),
            "Card",
            f"txn_{uuid4().hex}",
            "Completed",
        ],
    )

    return cursor.fetchone()[0]


def _map_integrity_error(error):
    lowered = str(error).lower()

    if "uq_ticket_seat_schedule" in lowered:
        return SeatConflictError("One of your selected seats was just booked by someone else.")

    if "aircraft capacity" in lowered or "trg_enforce_capacity" in lowered:
        return SeatConflictError("No remaining seats are available for this schedule.")

    if "payment failed" in lowered or "trg_verify_exact_payment" in lowered:
        return PaymentFailedError("Payment authorization failed. Please try another card.")

    if "invalid timeline" in lowered or "trg_verify_booking_timeline" in lowered:
        return RequestValidationError(
            "This booking cannot be completed because departure time has already passed."
        )

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
            with connection.cursor() as cursor:
                schedule = _fetch_schedule_for_update(cursor, schedule_id)
                departure_time = schedule["departure_time"]

                if departure_time is not None:
                    now = timezone.now().replace(tzinfo=None)
                    departure = departure_time.replace(tzinfo=None)
                    if departure <= now:
                        raise RequestValidationError(
                            "This flight has already departed and can no longer be booked."
                        )

                seat_by_id = _fetch_seat_rows_for_update(
                    cursor,
                    schedule["aircraft_id"],
                    seat_ids,
                )

                if len(seat_by_id) != len(set(seat_ids)):
                    raise RequestValidationError(
                        "One or more selected seats are invalid for this aircraft."
                    )

                _ensure_seats_available(cursor, schedule_id, seat_ids)

                total_price = sum(
                    (_seat_fare(seat_by_id[seat_id]["seat_class"]) for seat_id in seat_ids),
                    Decimal("0"),
                )

                if total_price <= 0:
                    raise PaymentFailedError("Payment amount is invalid for this booking.")

                user_id = _upsert_user(cursor, user_payload)
                booking_row = _insert_booking(cursor, user_id, total_price)
                booking_id = booking_row["booking_id"]

                passenger_ids = []
                for passenger_payload in passenger_payloads:
                    passenger_id = _upsert_passenger(cursor, passenger_payload)
                    passenger_ids.append(passenger_id)
                    _link_booking_passenger(cursor, booking_id, passenger_id)

                seat_numbers = []
                for assignment in ordered_assignments:
                    passenger_index = assignment["passenger_index"]
                    seat_id = int(assignment["seat_id"])

                    passenger_id = passenger_ids[passenger_index]
                    seat = seat_by_id[seat_id]
                    fare_paid = _seat_fare(seat["seat_class"])

                    _insert_ticket(
                        cursor,
                        booking_id,
                        passenger_id,
                        schedule_id,
                        seat_id,
                        schedule["aircraft_id"],
                        fare_paid,
                        passenger_index,
                    )

                    seat_numbers.append(seat["seat_number"])

                _insert_payment(cursor, booking_id, total_price)

                return {
                    "booking_id": booking_id,
                    "booking_date": booking_row["booking_date"].isoformat(),
                    "total_amount": float(total_price),
                    "status": _normalize_status(booking_row["booking_status"]),
                    "schedule_id": schedule_id,
                    "route_code": schedule["route_code"],
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
