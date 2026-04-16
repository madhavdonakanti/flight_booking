from django.urls import path

from . import views

urlpatterns = [
    path("schedules/", views.schedules_view, name="schedules"),
    path("seats/", views.seats_view, name="seats"),
    path("tickets/", views.tickets_view, name="tickets"),
    path("bookings/", views.bookings_view, name="bookings"),
    path("bookings/finalize/", views.finalize_booking_view, name="bookings-finalize"),
]
