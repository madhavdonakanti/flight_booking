# Flight Backend

This folder contains the Django + DRF backend used by the flight booking frontend.

## 1. Setup

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Copy the environment template and update values:

```bash
cp .env.example .env
```

4. Export variables from `.env` (or set them in your shell) before starting Django.

## 2. Run

From `back_end/flight_backend`:

```bash
python manage.py runserver
```

Default API root: `http://localhost:8000/api/`

## 3. Required Environment Variables

- `DJANGO_SECRET_KEY`
- `DJANGO_DEBUG`
- `DJANGO_ALLOWED_HOSTS`
- `DATABASE_URL` (Supabase/PostgreSQL connection string)
- `DJANGO_DB_SSL_REQUIRE`
- `DJANGO_CORS_ALLOW_ALL_ORIGINS`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `DJANGO_CORS_ALLOW_CREDENTIALS`
- `DJANGO_CSRF_TRUSTED_ORIGINS`

## 4. Customer Flow Endpoints

- `GET /api/schedules/?origin=&destination=&date=`
- `GET /api/seats/?aircraft_id=`
- `GET /api/tickets/?schedule_id=`
- `GET /api/bookings/?name=&email=&phone=`
- `POST /api/bookings/finalize/`

`POST /api/bookings/finalize/` expects:

```json
{
	"user": {
		"name": "Alex Carter",
		"email": "alex@example.com",
		"phone": "+1-555-0101"
	},
	"passengers": [
		{
			"first_name": "Alex",
			"last_name": "Carter",
			"passport_number": "X1234567",
			"birth_date": "1995-04-12"
		}
	],
	"schedule_id": 9101,
	"seat_ids": [201011],
	"seat_assignments": [
		{
			"passenger_index": 0,
			"seat_id": 201011
		}
	]
}
```

## 5. Error Semantics Used by Frontend

- Seat conflicts return `409` with `error: "SEAT_TAKEN"`.
- Payment failures return `402` with `error: "PAYMENT_FAILED"`.
- Generic validation failures return `400` with `error: "INVALID_REQUEST"`.

## 6. Database Migrations

This project uses standard Django ORM migrations. To apply database migrations:

```bash
python manage.py migrate
```

Render (Root Directory = `back_end`) recommended Start Command:

```bash
cd flight_backend && python manage.py migrate --noinput && gunicorn backend_core.wsgi:application --bind 0.0.0.0:$PORT
```

