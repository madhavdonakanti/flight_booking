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
  const userDetails = useBookingStore((state) => state.userDetails);
  const passengers = useBookingStore((state) => state.passengers);
  const selectedSeatAssignments = useBookingStore((state) => state.selectedSeatIds);
  const getTotalPrice = useBookingStore((state) => state.getTotalPrice);
  const clearCart = useBookingStore((state) => state.clearCart);

  const [seatNumberMap, setSeatNumberMap] = useState({});
  const [isSeatLoading, setIsSeatLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const assignedPassengerCount = useMemo(() => {
    return new Set(selectedSeatAssignments.map((entry) => entry?.passengerIndex)).size;
  }, [selectedSeatAssignments]);

  const assignedSeatCount = useMemo(() => {
    return new Set(selectedSeatAssignments.map((entry) => String(entry?.seatId))).size;
  }, [selectedSeatAssignments]);

  const hasSeatPassengerMismatch =
    selectedSeatAssignments.length !== passengers.length ||
    assignedPassengerCount !== passengers.length ||
    assignedSeatCount !== selectedSeatAssignments.length;
  const mismatchErrorMessage =
    'Seat assignment mismatch. Please ensure every passenger has exactly one unique seat.';
  const derivedTotalPrice = getTotalPrice();
  const hasValidUserDetails = Boolean(
    userDetails?.name?.trim() && userDetails?.email?.trim() && userDetails?.phone?.trim()
  );
  const hasValidCheckoutState = !hasSeatPassengerMismatch && derivedTotalPrice > 0;

  useEffect(() => {
    const queryString = location.search;

    if (!selectedSchedule || scheduleId == null || !hasValidCheckoutState) {
      navigate(queryString ? `/book/seats${queryString}` : '/book/seats', { replace: true });
    }
  }, [selectedSchedule, scheduleId, hasValidCheckoutState, location.search, navigate]);

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
    return [...selectedSeatAssignments]
      .sort((a, b) => (a?.passengerIndex ?? 0) - (b?.passengerIndex ?? 0))
      .map((assignment) => {
        const seatId = assignment?.seatId;
        const passengerLabel = `P${(assignment?.passengerIndex ?? 0) + 1}`;
        const seatLabel = seatNumberMap[String(seatId)] || `Seat ${seatId}`;
        return `${passengerLabel}: ${seatLabel}`;
      });
  }, [selectedSeatAssignments, seatNumberMap]);

  const displayTotal = Number.isFinite(derivedTotalPrice) ? derivedTotalPrice : 0;

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

    if (passengers.length === 0 || selectedSeatAssignments.length === 0) {
      setSubmitError('Passengers and seat selections are required before final checkout.');
      return;
    }

    if (!hasValidUserDetails) {
      setSubmitError('Guest details are missing. Please go back and complete your details first.');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      const user = {
        name: userDetails.name.trim(),
        email: userDetails.email.trim(),
        phone: userDetails.phone.trim(),
      };

      await submitFinalBooking({
        user,
        passengers,
        selectedScheduleId: scheduleId,
        selectedSeatAssignments,
      });

      clearCart();
      navigate('/success');
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