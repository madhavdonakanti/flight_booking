from django.urls import path

from . import views

urlpatterns = [
    path("auth/register/", views.register_view, name="auth-register"),
    path("auth/login/", views.login_view, name="auth-login"),
    path("auth/me/", views.me_view, name="auth-me"),
    path("schedules/", views.schedules_view, name="schedules"),
    path("seats/", views.seats_view, name="seats"),
    path("tickets/", views.tickets_view, name="tickets"),
    path("bookings/", views.bookings_view, name="bookings"),
    path("bookings/lookup/", views.pnr_lookup_view, name="bookings-lookup"),
    path("bookings/my-bookings/", views.my_bookings_view, name="my-bookings"),
    path("bookings/finalize/", views.finalize_booking_view, name="bookings-finalize"),
    path("admin/login/", views.admin_login_view, name="admin-login"),
    path("admin/me/", views.admin_me_view, name="admin-me"),
    path("admin/aircraft/", views.admin_aircraft_view, name="admin-aircraft"),
    path("admin/aircraft/<int:aircraft_id>/", views.admin_aircraft_detail_view, name="admin-aircraft-detail"),
    path("admin/schedules/", views.admin_schedules_view, name="admin-schedules"),
    path("admin/schedules/<int:schedule_id>/", views.admin_schedule_detail_view, name="admin-schedule-detail"),
    path("admin/bookings/", views.admin_bookings_view, name="admin-bookings"),
    path("admin/bookings/<int:booking_id>/status/", views.admin_booking_update_view, name="admin-booking-update"),
    path("admin/audit-logs/", views.admin_audit_logs_view, name="admin-audit-logs"),
]
