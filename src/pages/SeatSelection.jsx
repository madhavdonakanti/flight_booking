import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchBookedSeatIdsByScheduleId, fetchSeatsByAircraftId } from '../api/apiService';
import SeatMap from '../components/SeatMap';
import useBookingStore from '../store/useBookingStore';

const FLAT_SEAT_RATE = 150;

const getScheduleId = (selectedSchedule, selectedScheduleId) => {
  if (selectedSchedule?.schedule_id != null) {
    return selectedSchedule.schedule_id;
  }

  return selectedScheduleId;
};

const getAircraftId = (selectedSchedule) => {
  if (!selectedSchedule || typeof selectedSchedule !== 'object') {
    return null;
  }

  return selectedSchedule.aircraft_id ?? selectedSchedule.aircraft?.aircraft_id ?? null;
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

function SeatSelection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const selectedSchedule = useBookingStore((state) => state.selectedSchedule);
  const selectedScheduleId = useBookingStore((state) => state.selectedScheduleId);
  const passengers = useBookingStore((state) => state.passengers);
  const selectedSeatIds = useBookingStore((state) => state.selectedSeatIds);
  const setTotalPrice = useBookingStore((state) => state.setTotalPrice);

  const [allSeats, setAllSeats] = useState([]);
  const [bookedSeatIds, setBookedSeatIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectionError, setSelectionError] = useState('');

  const scheduleId = useMemo(
    () => getScheduleId(selectedSchedule, selectedScheduleId),
    [selectedSchedule, selectedScheduleId]
  );
  const aircraftId = useMemo(() => getAircraftId(selectedSchedule), [selectedSchedule]);

  const expectedPassengerCount = useMemo(() => {
    if (passengers.length > 0) {
      return passengers.length;
    }

    const fromQuery = Number(searchParams.get('passengers'));
    if (Number.isInteger(fromQuery) && fromQuery > 0) {
      return fromQuery;
    }

    return 0;
  }, [passengers.length, searchParams]);

  useEffect(() => {
    setTotalPrice(selectedSeatIds.length * FLAT_SEAT_RATE);
  }, [selectedSeatIds.length, setTotalPrice]);

  useEffect(() => {
    let isMounted = true;

    if (scheduleId == null || aircraftId == null) {
      return () => {
        isMounted = false;
      };
    }

    const loadSeatData = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const [seatsResponse, bookedIdsResponse] = await Promise.all([
          fetchSeatsByAircraftId(aircraftId),
          fetchBookedSeatIdsByScheduleId(scheduleId),
        ]);

        if (!isMounted) {
          return;
        }

        setAllSeats(normalizeSeats(seatsResponse));
        setBookedSeatIds(Array.isArray(bookedIdsResponse) ? bookedIdsResponse : []);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message =
          typeof error === 'string' ? error : 'Unable to load seats for this flight. Please try again.';
        setErrorMessage(message);
        setAllSeats([]);
        setBookedSeatIds([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSeatData();

    return () => {
      isMounted = false;
    };
  }, [aircraftId, scheduleId]);

  if (!selectedSchedule) {
    return <Navigate to="/" replace />;
  }

  const handleProceedToCheckout = () => {
    if (expectedPassengerCount <= 0) {
      setSelectionError('Please complete passenger details before selecting seats.');
      return;
    }

    if (selectedSeatIds.length !== expectedPassengerCount) {
      setSelectionError(
        `Please select exactly ${expectedPassengerCount} seat${expectedPassengerCount > 1 ? 's' : ''}.`
      );
      return;
    }

    setSelectionError('');

    const queryString = searchParams.toString();
    navigate(queryString ? `/book/checkout?${queryString}` : '/book/checkout');
  };

  const routeCode =
    selectedSchedule?.route_code || selectedSchedule?.flight?.route_code || 'Selected Route';

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.3)] sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Booking Flow</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Seat Selection</h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              {routeCode} | Select {expectedPassengerCount || 1} seat
              {expectedPassengerCount === 1 ? '' : 's'}
            </p>
          </div>

          <Link
            to={searchParams.toString() ? `/book/passengers?${searchParams.toString()}` : '/book/passengers'}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Back to Passengers
          </Link>
        </div>

        {errorMessage ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-16 text-sm font-medium text-slate-600">
            Loading seat map...
          </div>
        ) : (
          <SeatMap allSeats={allSeats} bookedSeatIds={bookedSeatIds} />
        )}

        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-700">
            Selected {selectedSeatIds.length} of {expectedPassengerCount || 0} required seat
            {expectedPassengerCount === 1 ? '' : 's'}.
          </p>

          <button
            type="button"
            onClick={handleProceedToCheckout}
            disabled={isLoading || Boolean(errorMessage)}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-sky-600 px-6 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            Proceed to Checkout
          </button>
        </div>

        {selectionError ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
          >
            {selectionError}
          </p>
        ) : null}
      </div>
    </section>
  );
}

export default SeatSelection;