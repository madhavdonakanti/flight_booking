from unittest.mock import patch

from rest_framework.test import APITestCase

from .services import PaymentFailedError, SeatConflictError


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
