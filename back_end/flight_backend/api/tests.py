from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Aircraft, Flight, Schedule, Seat, Ticket, User, Booking, Passenger, Payment
from .services import (
    PaymentFailedError,
    SeatConflictError,
    fetch_bookings_by_user,
    fetch_schedules,
    fetch_seats_by_aircraft_id,
    fetch_tickets_by_schedule_id,
    finalize_booking,
)


class ApiEndpointTests(APITestCase):
    @patch("api.views.fetch_schedules")
    def test_schedules_endpoint_returns_data(self, mock_fetch_schedules):
        mock_fetch_schedules.return_value = [
            {
                "schedule_id": 1,
                "route_code": "JFK-LAX",
                "departure_time": "2026-05-01T10:00:00",
                "arrival_time": "2026-05-01T14:00:00",
                "aircraft_id": 10,
                "flight_id": 100,
            }
        ]

        response = self.client.get(
            "/api/schedules/",
            {
                "origin": "JFK",
                "destination": "LAX",
                "date": "2026-05-01",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)

    def test_seats_endpoint_requires_aircraft_id(self):
        response = self.client.get("/api/seats/", format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json().get("error"), "INVALID_REQUEST")

    @patch("api.views.finalize_booking")
    def test_finalize_maps_seat_conflict_to_409(self, mock_finalize_booking):
        mock_finalize_booking.side_effect = SeatConflictError(
            "One of your selected seats was just booked by someone else."
        )

        response = self.client.post(
            "/api/bookings/finalize/",
            {
                "user": {
                    "name": "Test User",
                    "email": "test@example.com",
                    "phone": "1234567890",
                },
                "passengers": [
                    {
                        "first_name": "Test",
                        "last_name": "Passenger",
                        "passport_number": "P12345",
                        "birth_date": "1995-01-01",
                    }
                ],
                "schedule_id": 1,
                "seat_ids": [101],
                "seat_assignments": [
                    {
                        "passenger_index": 0,
                        "seat_id": 101,
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json().get("error"), "SEAT_TAKEN")

    @patch("api.views.finalize_booking")
    def test_finalize_maps_payment_failure_to_402(self, mock_finalize_booking):
        mock_finalize_booking.side_effect = PaymentFailedError(
            "Payment authorization failed. Please try another card."
        )

        response = self.client.post(
            "/api/bookings/finalize/",
            {
                "user": {
                    "name": "Test User",
                    "email": "test@example.com",
                    "phone": "1234567890",
                },
                "passengers": [
                    {
                        "first_name": "Test",
                        "last_name": "Passenger",
                        "passport_number": "P12345",
                        "birth_date": "1995-01-01",
                    }
                ],
                "schedule_id": 1,
                "seat_ids": [101],
                "seat_assignments": [
                    {
                        "passenger_index": 0,
                        "seat_id": 101,
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 402)
        self.assertEqual(response.json().get("error"), "PAYMENT_FAILED")


class OrmServiceIntegrationTests(APITestCase):
    def setUp(self):
        self.aircraft = Aircraft.objects.create(
            tail_number="N999XX",
            manufacturer="Boeing",
            model="737-800",
            total_capacity=2,
            manufacture_year=2020,
        )
        self.flight = Flight.objects.create(
            flight_number="AA100",
            origin_airport_code="JFK",
            destination_airport_code="LAX",
            base_duration_minutes=360,
        )
        self.schedule = Schedule.objects.create(
            flight=self.flight,
            aircraft=self.aircraft,
            departure_time=timezone.now() + timedelta(days=5),
            arrival_time=timezone.now() + timedelta(days=5, hours=6),
            flight_status="Scheduled",
        )
        self.seat1 = Seat.objects.create(
            aircraft=self.aircraft,
            seat_number="1A",
            seat_class="Business",
        )
        self.seat2 = Seat.objects.create(
            aircraft=self.aircraft,
            seat_number="12B",
            seat_class="Economy",
        )

    def test_fetch_schedules_orm(self):
        schedules = fetch_schedules(origin="JFK", destination="LAX")
        self.assertEqual(len(schedules), 1)
        self.assertEqual(schedules[0]["route_code"], "JFK-LAX")

    def test_fetch_seats_orm(self):
        seats = fetch_seats_by_aircraft_id(self.aircraft.aircraft_id)
        self.assertEqual(len(seats), 2)

    def test_finalize_booking_flow_orm(self):
        payload = {
            "user": {
                "name": "Jane Doe",
                "email": "jane@example.com",
                "phone": "+1-555-9999",
            },
            "passengers": [
                {
                    "first_name": "Jane",
                    "last_name": "Doe",
                    "passport_number": "J987654",
                    "birth_date": "1990-05-15",
                }
            ],
            "schedule_id": self.schedule.schedule_id,
            "seat_ids": [self.seat1.seat_id],
            "seat_assignments": [
                {
                    "passenger_index": 0,
                    "seat_id": self.seat1.seat_id,
                }
            ],
        }

        result = finalize_booking(payload)
        self.assertIn("booking_id", result)
        self.assertEqual(result["total_amount"], 500.0)
        self.assertEqual(result["seats"], ["1A"])

        # Check DB entries created
        self.assertTrue(User.objects.filter(email="jane@example.com").exists())
        self.assertTrue(Booking.objects.filter(booking_id=result["booking_id"]).exists())
        self.assertTrue(Ticket.objects.filter(booking_id=result["booking_id"]).exists())
        self.assertTrue(Payment.objects.filter(booking_id=result["booking_id"]).exists())

    def test_double_booking_prevention_orm(self):
        payload = {
            "user": {
                "name": "User One",
                "email": "user1@example.com",
                "phone": "1111111111",
            },
            "passengers": [
                {
                    "first_name": "User",
                    "last_name": "One",
                    "passport_number": "U1111",
                    "birth_date": "1990-01-01",
                }
            ],
            "schedule_id": self.schedule.schedule_id,
            "seat_ids": [self.seat1.seat_id],
            "seat_assignments": [
                {
                    "passenger_index": 0,
                    "seat_id": self.seat1.seat_id,
                }
            ],
        }
        finalize_booking(payload)

        # Attempt booking same seat again
        with self.assertRaises(SeatConflictError):
            finalize_booking(payload)


class AuthAndSecurityTests(APITestCase):
    def test_register_and_login_flow(self):
        # Register new user
        reg_response = self.client.post(
            "/api/auth/register/",
            {
                "name": "Auth User",
                "email": "authuser@example.com",
                "phone": "555-0199",
                "password": "secretpassword123",
            },
            format="json",
        )
        self.assertEqual(reg_response.status_code, 201)
        self.assertIn("token", reg_response.json())

        token = reg_response.json()["token"]

        # Access /api/auth/me/ with Bearer token
        me_response = self.client.get(
            "/api/auth/me/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
            format="json",
        )
        self.assertEqual(me_response.status_code, 200)
        self.assertEqual(me_response.json()["user"]["email"], "authuser@example.com")

        # Test login
        login_response = self.client.post(
            "/api/auth/login/",
            {
                "email": "authuser@example.com",
                "password": "secretpassword123",
            },
            format="json",
        )
        self.assertEqual(login_response.status_code, 200)
        self.assertIn("token", login_response.json())

    def test_unusable_guest_password(self):
        aircraft = Aircraft.objects.create(tail_number="N-GUEST", manufacturer="Boeing", model="737", total_capacity=100)
        flight = Flight.objects.create(flight_number="F-GUEST", origin_airport_code="JFK", destination_airport_code="LAX", base_duration_minutes=300)
        schedule = Schedule.objects.create(flight=flight, aircraft=aircraft, departure_time=timezone.now() + timedelta(days=1), arrival_time=timezone.now() + timedelta(days=1, hours=5), flight_status="Scheduled")
        seat = Seat.objects.create(aircraft=aircraft, seat_number="1A", seat_class="Economy")

        payload = {
            "user": {"name": "Guest Customer", "email": "guestcust@example.com", "phone": "123"},
            "passengers": [{"first_name": "Guest", "last_name": "Cust", "birth_date": "2000-01-01"}],
            "schedule_id": schedule.schedule_id,
            "seat_ids": [seat.seat_id],
            "seat_assignments": [{"passenger_index": 0, "seat_id": seat.seat_id}],
        }
        res = finalize_booking(payload)

        # Verify password is unusable and plain guest login fails
        u = User.objects.get(email="guestcust@example.com")
        self.assertFalse(u.password_hash.startswith("guest-"))

        login_res = self.client.post(
            "/api/auth/login/",
            {"email": "guestcust@example.com", "password": "guest-account"},
            format="json",
        )
        self.assertEqual(login_res.status_code, 400)

    def test_pnr_guest_lookup(self):
        aircraft = Aircraft.objects.create(tail_number="N-PNR", manufacturer="Boeing", model="737", total_capacity=100)
        flight = Flight.objects.create(flight_number="F-PNR", origin_airport_code="JFK", destination_airport_code="LAX", base_duration_minutes=300)
        schedule = Schedule.objects.create(flight=flight, aircraft=aircraft, departure_time=timezone.now() + timedelta(days=1), arrival_time=timezone.now() + timedelta(days=1, hours=5), flight_status="Scheduled")
        seat = Seat.objects.create(aircraft=aircraft, seat_number="1B", seat_class="Economy")

        payload = {
            "user": {"name": "PNR Cust", "email": "pnrcust@example.com", "phone": "999"},
            "passengers": [{"first_name": "PNR", "last_name": "Cust", "birth_date": "2000-01-01"}],
            "schedule_id": schedule.schedule_id,
            "seat_ids": [seat.seat_id],
            "seat_assignments": [{"passenger_index": 0, "seat_id": seat.seat_id}],
        }
        res = finalize_booking(payload)

        lookup_res = self.client.get(
            "/api/bookings/lookup/",
            {"booking_id": res["booking_id"], "email": "pnrcust@example.com"},
            format="json",
        )
        self.assertEqual(lookup_res.status_code, 200)
        self.assertEqual(len(lookup_res.json()), 1)

        # Wrong email lookup fails
        failed_res = self.client.get(
            "/api/bookings/lookup/",
            {"booking_id": res["booking_id"], "email": "wrong@example.com"},
            format="json",
        )
        self.assertEqual(failed_res.status_code, 404)

