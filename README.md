# SkyWay Airlines - Flight Booking & Operations System

SkyWay Airlines is a full-stack flight reservation system and internal administrative portal built with a **React (Vite + TailwindCSS)** frontend and a **Django REST Framework (DRF)** backend.

---

## ✈️ System Overview

The application consists of two main portals:

1. **Customer Reservation Portal**:
   - Search real-time flight schedules by origin, destination, and departure date.
   - Interactive seat map selection (Economy & Business classes with dynamic fare calculation).
   - Passenger details management & instant booking confirmation.
   - User Registration / Login (JWT authentication) and PNR Booking Lookup.
   - Personal booking history management.

2. **Internal Operations & Admin Portal**:
   - Role-Based Access Control (**RBAC**): Separate privileges for **Admin** and **Staff** employees.
   - Fleet Management: Add and delete aircraft with automated seat map generation.
   - Flight Scheduling: Create and cancel flight schedules with origin/destination routing.
   - Booking Management: Search, update, and manage customer booking statuses.
   - Audit Logging: Track administrative actions and status updates with employee timestamps.

---

## 🚨 CRITICAL DEPLOYMENT INSTRUCTIONS (Render / Cloud)

> [!IMPORTANT]
> **Set `DJANGO_DEBUG=False` before deploying to Render!**
> 
> In local development (`DJANGO_DEBUG=True`), the backend automatically seeds demo employee accounts (`admin@skyway.com` / `admin123` and `staff@skyway.com` / `staff123`) for testing convenience.
> 
> **When deploying to Render or any cloud provider:**
> You **MUST** set `DJANGO_DEBUG=False` in Render Environment Variables. Setting `DJANGO_DEBUG=False` automatically disables demo account auto-seeding on your production database, ensuring hardcoded default credentials are **never** created on your live cloud database.

---

## ⚙️ Render Deployment Environment Variables

Configure the following environment variables in your Render Web Service dashboard:

| Variable | Recommended Production Value | Description |
| :--- | :--- | :--- |
| `DJANGO_DEBUG` | `False` | **Required.** Disables dev mode and demo account auto-seeding. |
| `DJANGO_SECRET_KEY` | `openssl rand -hex 32` | **Required.** Cryptographic key for signing JWTs and sessions. |
| `DATABASE_URL` | `postgres://user:pass@host/dbname` | **Required.** Connection string for Supabase or PostgreSQL. |
| `DJANGO_ALLOWED_HOSTS` | `your-backend.onrender.com` | Allowed backend host header names. |
| `DJANGO_CORS_ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` | Allowed origins permitted for credentialed API requests. |
| `DJANGO_DB_SSL_REQUIRE` | `True` | Enforces SSL database connections. |

### Render Build & Start Commands

- **Root Directory**: `back_end`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**:
  ```bash
  cd flight_backend && python manage.py migrate --noinput && gunicorn backend_core.wsgi:application --bind 0.0.0.0:$PORT
  ```

---

## 💻 Local Development Setup

### 1. Backend Setup (Django + DRF)

```bash
cd back_end/flight_backend

# Install Python dependencies
pip install -r ../requirements.txt

# Apply database migrations (SQLite default for dev)
python manage.py migrate

# Run development server
python manage.py runserver
```

Backend server runs at `http://127.0.0.1:8000/api/`

### 2. Frontend Setup (React + Vite)

```bash
cd front_end

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

Frontend runs at `http://localhost:5173/`

### 3. Running Unit Tests

```bash
cd back_end/flight_backend
python manage.py test api
```

