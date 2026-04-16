import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchBookedSeatIdsByScheduleId, fetchSeatsByAircraftId } from '../api/apiService';
import SeatMap from '../components/SeatMap';
import useBookingStore from '../store/useBookingStore';

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

const formatSeatClassLabel = (seatClass) => {
  if (typeof seatClass !== 'string' || !seatClass.trim()) {
    return 'Economy';
  }

  const normalized = seatClass.trim().toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

function SeatSelection() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const selectedSchedule = useBookingStore((state) => state.selectedSchedule);
  const selectedScheduleId = useBookingStore((state) => state.selectedScheduleId);
  const passengers = useBookingStore((state) => state.passengers);
  const selectedSeatIds = useBookingStore((state) => state.selectedSeatIds);
  const setAllSeatsInStore = useBookingStore((state) => state.setAllSeats);
  const toggleSeatSelection = useBookingStore((state) => state.toggleSeatSelection);

  const [allSeats, setAllSeats] = useState([]);
  const [bookedSeatIds, setBookedSeatIds] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const [activeSeatDetails, setActiveSeatDetails] = useState(null);
  const [activePassengerIndex, setActivePassengerIndex] = useState(0);

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

  const seatById = useMemo(() => {
    return new Map(
      allSeats
        .filter((seat) => seat?.seat_id != null)
        .map((seat) => [String(seat.seat_id), seat])
    );
  }, [allSeats]);

  const selectedSeatOnlyIds = useMemo(() => {
    return selectedSeatIds
      .map((assignment) => assignment?.seatId)
      .filter((seatId) => seatId != null);
  }, [selectedSeatIds]);

  const passengerSeatAssignments = useMemo(() => {
    return passengers.map((passenger, passengerIndex) => {
      const assignment = selectedSeatIds.find((entry) => entry?.passengerIndex === passengerIndex);
      const seatId = assignment?.seatId;
      const seat = seatId != null ? seatById.get(String(seatId)) : null;

      return {
        passengerIndex,
        passenger,
        seatId,
        seatLabel: seat?.seat_number || (seatId != null ? `Seat ${seatId}` : 'Not assigned'),
        seatClass: formatSeatClassLabel(seat?.seat_class),
      };
    });
  }, [passengers, selectedSeatIds, seatById]);

  const assignedPassengerCount = useMemo(() => {
    return new Set(selectedSeatIds.map((entry) => entry?.passengerIndex)).size;
  }, [selectedSeatIds]);

  useEffect(() => {
    if (!selectedSchedule) {
      navigate('/home', { replace: true });
      return;
    }

    if (passengers.length === 0) {
      const queryString = location.search;
      navigate(queryString ? `/book/passengers${queryString}` : '/book/passengers', { replace: true });
    }
  }, [selectedSchedule, passengers.length, location.search, navigate]);

  useEffect(() => {
    if (passengers.length === 0) {
      setActivePassengerIndex(0);
      return;
    }

    setActivePassengerIndex((prev) => {
      if (prev < 0) {
        return 0;
      }

      if (prev >= passengers.length) {
        return passengers.length - 1;
      }

      return prev;
    });
  }, [passengers.length]);

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

        const normalizedSeats = normalizeSeats(seatsResponse);
        setAllSeats(normalizedSeats);
        setAllSeatsInStore(normalizedSeats);
        setBookedSeatIds(Array.isArray(bookedIdsResponse) ? bookedIdsResponse : []);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message =
          typeof error === 'string' ? error : 'Unable to load seats for this flight. Please try again.';
        setErrorMessage(message);
        setAllSeats([]);
        setAllSeatsInStore([]);
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
  }, [aircraftId, scheduleId, setAllSeatsInStore]);

  if (!selectedSchedule || passengers.length === 0) {
    return null;
  }

  const handleProceedToCheckout = () => {
    if (expectedPassengerCount <= 0) {
      setSelectionError('Please complete passenger details before selecting seats.');
      return;
    }

    if (assignedPassengerCount !== expectedPassengerCount) {
      setSelectionError(
        `Please assign exactly one seat to each of the ${expectedPassengerCount} passenger${expectedPassengerCount > 1 ? 's' : ''}.`
      );
      return;
    }

    setSelectionError('');

    const queryString = searchParams.toString();
    navigate(queryString ? `/book/checkout?${queryString}` : '/book/checkout');
  };

  const routeCode =
    selectedSchedule?.route_code || selectedSchedule?.flight?.route_code || 'Selected Route';

  const handleSeatFocusChange = (seat) => {
    if (!seat || seat.seat_id == null) {
      setActiveSeatDetails(null);
      return;
    }

    setActiveSeatDetails({
      seatNumber: seat.seat_number || `Seat ${seat.seat_id}`,
      seatClass: formatSeatClassLabel(seat.seat_class),
    });
  };

  const handleSeatSelection = (seat) => {
    if (!seat || seat.seat_id == null) {
      return;
    }

    const seatId = seat.seat_id;
    const isSeatAssignedElsewhere = selectedSeatIds.some(
      (entry) => String(entry?.seatId) === String(seatId) && entry?.passengerIndex !== activePassengerIndex
    );
    const currentAssignment = selectedSeatIds.find(
      (entry) => entry?.passengerIndex === activePassengerIndex
    );
    const isDeselectAction = currentAssignment?.seatId === seatId;

    toggleSeatSelection(activePassengerIndex, seatId);
    handleSeatFocusChange(seat);

    if (isDeselectAction || isSeatAssignedElsewhere) {
      return;
    }

    const nextUnassigned = passengerSeatAssignments.find(
      (entry) => entry.passengerIndex !== activePassengerIndex && entry.seatId == null
    );

    if (nextUnassigned) {
      setActivePassengerIndex(nextUnassigned.passengerIndex);
    }
  };

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

        <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Passenger Seat Assignments</p>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {passengerSeatAssignments.map((entry) => {
              const firstName = entry.passenger?.first_name?.trim() || 'First';
              const lastName = entry.passenger?.last_name?.trim() || 'Last';
              const isActive = entry.passengerIndex === activePassengerIndex;

              return (
                <button
                  key={`passenger-seat-${entry.passengerIndex}`}
                  type="button"
                  onClick={() => setActivePassengerIndex(entry.passengerIndex)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">
                    Passenger {entry.passengerIndex + 1}: {firstName} {lastName}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {entry.seatId != null
                      ? `${entry.seatLabel} | ${entry.seatClass}`
                      : 'Seat not assigned'}
                  </p>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Currently assigning seat for Passenger {activePassengerIndex + 1}.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-16 text-sm font-medium text-slate-600">
            Loading seat map...
          </div>
        ) : (
          <SeatMap
            allSeats={allSeats}
            bookedSeatIds={bookedSeatIds}
            selectedSeatIds={selectedSeatOnlyIds}
            onSeatHover={handleSeatFocusChange}
            onSeatSelect={handleSeatSelection}
          />
        )}

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          {activeSeatDetails ? (
            <p className="text-sm font-medium text-slate-700">
              {activeSeatDetails.seatNumber} | Class: {activeSeatDetails.seatClass}
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              Hover over or click a seat to view its class. Business seats are $500 and Economy seats are $150.
            </p>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm font-medium text-slate-700">
            Assigned {assignedPassengerCount} of {expectedPassengerCount || 0} required seat
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