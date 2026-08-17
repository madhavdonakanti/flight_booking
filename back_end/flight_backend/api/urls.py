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
]
