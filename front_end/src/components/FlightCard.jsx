import useBookingStore from '../store/useBookingStore';
import { useLocation, useNavigate } from 'react-router-dom';

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

const getRouteCode = (schedule) => {
  return schedule?.route_code || schedule?.flight?.route_code || 'Route unavailable';
};

const getAircraftModel = (schedule) => {
  if (schedule?.aircraft?.model) {
    return schedule.aircraft.model;
  }

  if (schedule?.aircraft_model) {
    return schedule.aircraft_model;
  }

  if (schedule?.aircraft_id) {
    return `Aircraft #${schedule.aircraft_id}`;
  }

  return 'Aircraft unavailable';
};

function FlightCard({ schedule }) {
  const setSchedule = useBookingStore((state) => state.setSchedule);
  const location = useLocation();
  const navigate = useNavigate();

  const scheduleId = schedule?.schedule_id;
  const routeCode = getRouteCode(schedule);
  const departureTime = formatDateTime(schedule?.departure_time);
  const arrivalTime = formatDateTime(schedule?.arrival_time);
  const aircraftModel = getAircraftModel(schedule);

  const handleSelectFlight = () => {
    if (scheduleId == null) {
      return;
    }

    setSchedule(schedule);

    const queryString = location.search;
    navigate(queryString ? `/book/passengers${queryString}` : '/book/passengers');
  };

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_-16px_rgba(15,23,42,0.4)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-18px_rgba(14,116,144,0.45)] sm:p-6">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500" />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Route</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{routeCode}</h3>
          </div>

          <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100">
            Schedule #{scheduleId ?? 'N/A'}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Departure</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{departureTime}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Arrival</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{arrivalTime}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aircraft</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{aircraftModel}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSelectFlight}
            disabled={scheduleId == null}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-sky-600 px-6 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            Select
          </button>
        </div>
      </div>
    </article>
  );
}

export default FlightCard;