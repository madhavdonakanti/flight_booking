import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchSeatsByAircraftId, submitFinalBooking } from '../api/apiService';
import useBookingStore from '../store/useBookingStore';

const formatDateTime = (value) => {
  if (!value) {
    return 'Not available';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsedDate);
};

const getAircraftId = (schedule) => {
  if (!schedule || typeof schedule !== 'object') {
    return null;
  }

  return schedule.aircraft_id ?? schedule.aircraft?.aircraft_id ?? null;
};

const normalizeSeats = (responseData) => {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  if (Array.isArray(responseData?.results)) {
    return responseData.results;
  }

  if (Array.isArray(responseData?.seats)) {
    return responseData.seats;
  }

  return [];
};

function CheckoutFlow() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const selectedSchedule = useBookingStore((state) => state.selectedSchedule);
  const selectedScheduleId = useBookingStore((state) => state.selectedScheduleId);
  const passengers = useBookingStore((state) => state.passengers);
  const selectedSeatIds = useBookingStore((state) => state.selectedSeatIds);
  const getTotalPrice = useBookingStore((state) => state.getTotalPrice);
  const clearCart = useBookingStore((state) => state.clearCart);

  const [seatNumberMap, setSeatNumberMap] = useState({});
  const [isSeatLoading, setIsSeatLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    cardholderName: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
  });

  const routeCode =
    selectedSchedule?.route_code || selectedSchedule?.flight?.route_code || 'Selected Route';
  const departureTime = formatDateTime(selectedSchedule?.departure_time);
  const arrivalTime = formatDateTime(selectedSchedule?.arrival_time);
  const scheduleId = selectedSchedule?.schedule_id ?? selectedScheduleId;
  const aircraftId = getAircraftId(selectedSchedule);

  const passengerNames = useMemo(() => {
    return passengers.map((passenger, index) => {
      const firstName = passenger?.first_name?.trim() || 'First';
      const lastName = passenger?.last_name?.trim() || 'Last';
      return `${index + 1}. ${firstName} ${lastName}`;
    });
  }, [passengers]);

  const hasSeatPassengerMismatch = passengers.length !== selectedSeatIds.length;
  const mismatchErrorMessage = `Mismatch: You have ${passengers.length} passengers but ${selectedSeatIds.length} seats selected. Please go back and adjust your seats.`;
  const derivedTotalPrice = getTotalPrice();
  const hasValidCheckoutState = selectedSeatIds.length === passengers.length && derivedTotalPrice > 0;

  useEffect(() => {
    if (isSuccess) {
      return;
    }

    const queryString = location.search;

    if (!selectedSchedule || scheduleId == null || !hasValidCheckoutState) {
      navigate(queryString ? `/book/seats${queryString}` : '/book/seats', { replace: true });
    }
  }, [isSuccess, selectedSchedule, scheduleId, hasValidCheckoutState, location.search, navigate]);

  useEffect(() => {
    let isMounted = true;

    if (aircraftId == null) {
      return () => {
        isMounted = false;
      };
    }

    const loadSeatNumbers = async () => {
      setIsSeatLoading(true);

      try {
        const seatResponse = await fetchSeatsByAircraftId(aircraftId);

        if (!isMounted) {
          return;
        }

        const seats = normalizeSeats(seatResponse);
        const nextSeatMap = seats.reduce((acc, seat) => {
          if (seat?.seat_id != null) {
            acc[String(seat.seat_id)] = seat.seat_number || `Seat ${seat.seat_id}`;
          }
          return acc;
        }, {});

        setSeatNumberMap(nextSeatMap);
      } catch {
        if (isMounted) {
          setSeatNumberMap({});
        }
      } finally {
        if (isMounted) {
          setIsSeatLoading(false);
        }
      }
    };

    loadSeatNumbers();

    return () => {
      isMounted = false;
    };
  }, [aircraftId]);

  const selectedSeatNumbers = useMemo(() => {
    return selectedSeatIds.map((seatId) => seatNumberMap[String(seatId)] || `Seat ${seatId}`);
  }, [selectedSeatIds, seatNumberMap]);

  const displayTotal = Number.isFinite(derivedTotalPrice) ? derivedTotalPrice : 0;

  if (isSuccess) {
    return (
      <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-[0_20px_60px_-28px_rgba(16,185,129,0.55)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Booking Confirmed</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-emerald-900">
            Your flight has been booked successfully.
          </h2>
          <p className="mt-3 text-sm text-emerald-800 sm:text-base">
            A confirmation summary will be available from your dashboard once backend integration is complete.
          </p>

          <div className="mt-6">
            <Link
              to="/"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              Book Another Flight
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (!selectedSchedule || scheduleId == null || !hasValidCheckoutState) {
    return null;
  }

  const handlePaymentFieldChange = (event) => {
    const { name, value } = event.target;
    setPaymentForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmitBooking = async (event) => {
    event.preventDefault();

    if (hasSeatPassengerMismatch) {
      return;
    }

    if (passengers.length === 0 || selectedSeatIds.length === 0) {
      setSubmitError('Passengers and seat selections are required before final checkout.');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      // Temporary mock user payload until auth/profile flow is implemented.
      const user = {
        name: paymentForm.cardholderName.trim() || 'Guest User',
        email: 'guest@example.com',
        phone: '',
      };

      await submitFinalBooking({
        user,
        passengers,
        selectedScheduleId: scheduleId,
        selectedSeatIds,
      });

      clearCart();
      setIsSuccess(true);
    } catch (error) {
      const message = typeof error === 'string' ? error : 'Unable to complete booking. Please try again.';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const backToSeatsHref = searchParams.toString()
    ? `/book/seats?${searchParams.toString()}`
    : '/book/seats';

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.3)] sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Booking Flow</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Checkout</h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Review your itinerary and complete payment to confirm your booking.
            </p>
          </div>

          <Link
            to={backToSeatsHref}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Back to Seats
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-lg font-semibold text-slate-900">Booking Summary</h3>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Flight</p>
                <p className="mt-1 text-sm font-medium text-slate-900">{routeCode}</p>
                <p className="mt-1 text-xs text-slate-600">Departure: {departureTime}</p>
                <p className="mt-1 text-xs text-slate-600">Arrival: {arrivalTime}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Passengers</p>
                <ul className="mt-1 space-y-1 text-sm text-slate-800">
                  {passengerNames.length > 0 ? (
                    passengerNames.map((name) => <li key={name}>{name}</li>)
                  ) : (
                    <li>No passengers selected.</li>
                  )}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seats</p>
                <p className="mt-1 text-sm text-slate-800">
                  {selectedSeatNumbers.length > 0
                    ? selectedSeatNumbers.join(', ')
                    : 'No seats selected.'}
                </p>
                {isSeatLoading ? (
                  <p className="mt-1 text-xs text-slate-500">Loading seat numbers...</p>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Price</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">${displayTotal.toFixed(2)}</p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-slate-900">Payment Details</h3>
            <p className="mt-1 text-sm text-slate-600">Mock payment form for frontend workflow testing.</p>

            <form onSubmit={handleSubmitBooking} className="mt-4 space-y-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cardholder Name</span>
                <input
                  type="text"
                  name="cardholderName"
                  value={paymentForm.cardholderName}
                  onChange={handlePaymentFieldChange}
                  placeholder="Name on card"
                  className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Card Number</span>
                <input
                  type="text"
                  name="cardNumber"
                  value={paymentForm.cardNumber}
                  onChange={handlePaymentFieldChange}
                  placeholder="1234 5678 9012 3456"
                  className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
                />
              </label>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expiry</span>
                  <input
                    type="text"
                    name="expiry"
                    value={paymentForm.expiry}
                    onChange={handlePaymentFieldChange}
                    placeholder="MM/YY"
                    className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">CVV</span>
                  <input
                    type="password"
                    name="cvv"
                    value={paymentForm.cvv}
                    onChange={handlePaymentFieldChange}
                    placeholder="123"
                    className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
                  />
                </label>
              </div>

              {submitError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
                >
                  {submitError}
                </p>
              ) : null}

              {hasSeatPassengerMismatch ? (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
                >
                  {mismatchErrorMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting || hasSeatPassengerMismatch}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-sky-600 px-6 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {isSubmitting ? 'Processing Payment...' : 'Pay Now'}
              </button>
            </form>
          </article>
        </div>
      </div>
    </section>
  );
}

export default CheckoutFlow;