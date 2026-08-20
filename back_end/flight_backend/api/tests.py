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
                "phone": "9876543210",
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
            "user": {"name": "Guest Customer", "email": "guestcust@example.com", "phone": "1234567890"},
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
            "user": {"name": "PNR Cust", "email": "pnrcust@example.com", "phone": "9876543210"},
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

    def test_phone_number_10_digit_validation(self):
        # 9 digit phone should fail
        res_invalid = self.client.post(
            "/api/auth/register/",
            {
                "name": "Short Phone",
                "email": "shortphone@example.com",
                "phone": "123456789",
                "password": "secretpassword123",
            },
            format="json",
        )
        self.assertEqual(res_invalid.status_code, 400)

        # 10 digit phone should succeed
        res_valid = self.client.post(
            "/api/auth/register/",
            {
                "name": "Valid Phone",
                "email": "validphone@example.com",
                "phone": "1234567890",
                "password": "secretpassword123",
            },
            format="json",
        )
        self.assertEqual(res_valid.status_code, 201)


class AdminAndStaffRbacTests(APITestCase):
    def setUp(self):
        from .admin_services import seed_default_employees
        seed_default_employees()

    def test_employee_login(self):
        admin_res = self.client.post(
            "/api/admin/login/",
            {"email": "admin@skyway.com", "password": "admin123"},
            format="json",
        )
        self.assertEqual(admin_res.status_code, 200)
        self.assertIn("Admin", admin_res.json()["employee"]["roles"])

        staff_res = self.client.post(
            "/api/admin/login/",
            {"email": "staff@skyway.com", "password": "staff123"},
            format="json",
        )
        self.assertEqual(staff_res.status_code, 200)
        self.assertIn("Staff", staff_res.json()["employee"]["roles"])

    def test_staff_cannot_create_aircraft_or_schedule(self):
        staff_login = self.client.post(
            "/api/admin/login/",
            {"email": "staff@skyway.com", "password": "staff123"},
            format="json",
        )
        staff_token = staff_login.json()["token"]

        # Staff attempt to create aircraft should fail with 403
        aircraft_res = self.client.post(
            "/api/admin/aircraft/",
            {
                "tail_number": "N-STAFF",
                "manufacturer": "Airbus",
                "model": "A320",
                "total_capacity": 150,
            },
            HTTP_AUTHORIZATION=f"Bearer {staff_token}",
            format="json",
        )
        self.assertEqual(aircraft_res.status_code, 403)

    def test_admin_can_create_aircraft_and_schedule(self):
        admin_login = self.client.post(
            "/api/admin/login/",
            {"email": "admin@skyway.com", "password": "admin123"},
            format="json",
        )
        admin_token = admin_login.json()["token"]

        # Create aircraft
        aircraft_res = self.client.post(
            "/api/admin/aircraft/",
            {
                "tail_number": "N-ADMIN1",
                "manufacturer": "Boeing",
                "model": "787-9",
                "total_capacity": 180,
                "manufacture_year": 2023,
            },
            HTTP_AUTHORIZATION=f"Bearer {admin_token}",
            format="json",
        )
        self.assertEqual(aircraft_res.status_code, 201)
        aircraft_id = aircraft_res.json()["aircraft_id"]

        # Create schedule
        dept_time = (timezone.now() + timedelta(days=2)).isoformat()
        arr_time = (timezone.now() + timedelta(days=2, hours=5)).isoformat()

        schedule_res = self.client.post(
            "/api/admin/schedules/",
            {
                "flight_number": "SW500",
                "origin_airport_code": "JFK",
                "destination_airport_code": "SFO",
                "base_duration_minutes": 330,
                "aircraft_id": aircraft_id,
                "departure_time": dept_time,
                "arrival_time": arr_time,
                "flight_status": "Scheduled",
            },
            HTTP_AUTHORIZATION=f"Bearer {admin_token}",
            format="json",
        )
        self.assertEqual(schedule_res.status_code, 201)
        self.assertEqual(schedule_res.json()["flight_number"], "SW500")

    def test_booking_status_update_creates_audit_log(self):
        user = User.objects.create(
            first_name="Test",
            last_name="Customer",
            email="cust@example.com",
            phone_number="1234567890",
            password_hash="hash",
            created_at=timezone.now(),
        )
        booking = Booking.objects.create(
            user=user,
            booking_date=timezone.now(),
            total_price=300.00,
            booking_status="Confirmed",
        )

        staff_login = self.client.post(
            "/api/admin/login/",
            {"email": "staff@skyway.com", "password": "staff123"},
            format="json",
        )
        staff_token = staff_login.json()["token"]

        update_res = self.client.put(
            f"/api/admin/bookings/{booking.booking_id}/status/",
            {
                "status": "Cancelled",
                "notes": "Cancelled per customer phone request.",
            },
            HTTP_AUTHORIZATION=f"Bearer {staff_token}",
            format="json",
        )
        self.assertEqual(update_res.status_code, 200)
        self.assertEqual(update_res.json()["status"], "Cancelled")

        # Verify audit log recorded
        logs_res = self.client.get(
            "/api/admin/audit-logs/",
            HTTP_AUTHORIZATION=f"Bearer {staff_token}",
            format="json",
        )
        self.assertEqual(logs_res.status_code, 200)
        self.assertTrue(len(logs_res.json()) >= 1)
        self.assertEqual(logs_res.json()[0]["action_type"], "CANCELLED")

    def test_token_type_isolation(self):
        # Admin token on user endpoint should fail
        admin_login = self.client.post(
            "/api/admin/login/",
            {"email": "admin@skyway.com", "password": "admin123"},
            format="json",
        )
        admin_token = admin_login.json()["token"]

        user_me_res = self.client.get(
            "/api/auth/me/",
            HTTP_AUTHORIZATION=f"Bearer {admin_token}",
            format="json",
        )
        self.assertEqual(user_me_res.status_code, 401)

        # User token on admin endpoint should fail
        user_reg = self.client.post(
            "/api/auth/register/",
            {
                "name": "Normal User",
                "email": "normaluser@example.com",
                "phone": "1234567890",
                "password": "userpass123",
            },
            format="json",
        )
        user_token = user_reg.json()["token"]

        admin_me_res = self.client.get(
            "/api/admin/me/",
            HTTP_AUTHORIZATION=f"Bearer {user_token}",
            format="json",
        )
        self.assertEqual(admin_me_res.status_code, 401)

    def test_employee_password_change_persists(self):
        from django.contrib.auth.hashers import make_password
        from .models import Employee

        # Change admin password
        admin_emp = Employee.objects.get(email="admin@skyway.com")
        admin_emp.password_hash = make_password("newsecurepass123")
        admin_emp.save()

        # Login with old password must fail
        failed_login = self.client.post(
            "/api/admin/login/",
            {"email": "admin@skyway.com", "password": "admin123"},
            format="json",
        )
        self.assertEqual(failed_login.status_code, 401)

        # Login with new password must succeed
        successful_login = self.client.post(
            "/api/admin/login/",
            {"email": "admin@skyway.com", "password": "newsecurepass123"},
            format="json",
        )
        self.assertEqual(successful_login.status_code, 200)

    def test_cors_middleware_allowed_origin(self):
        # Allowed origin
        response = self.client.get(
            "/api/schedules/",
            HTTP_ORIGIN="http://localhost:5173",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get("Access-Control-Allow-Origin"), "http://localhost:5173")

        # Disallowed origin
        bad_response = self.client.get(
            "/api/schedules/",
            HTTP_ORIGIN="http://malicious-site.com",
        )
        self.assertEqual(bad_response.status_code, 200)
        self.assertIsNone(bad_response.get("Access-Control-Allow-Origin"))



