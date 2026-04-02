import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchSchedules } from '../api/apiService';
import FlightCard from '../components/FlightCard';

const normalizeSchedules = (responseData) => {
  if (Array.isArray(responseData)) {
    return responseData;
  }

  if (Array.isArray(responseData?.results)) {
    return responseData.results;
  }

  if (Array.isArray(responseData?.schedules)) {
    return responseData.schedules;
  }

  return [];
};

function Results() {
  const [searchParams] = useSearchParams();
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const filters = useMemo(
    () => ({
      origin: searchParams.get('origin')?.trim() || '',
      destination: searchParams.get('dest')?.trim() || '',
      date: searchParams.get('date')?.trim() || '',
      passengers: searchParams.get('passengers')?.trim() || '',
    }),
    [searchParams]
  );

  const hasRequiredFilters = Boolean(filters.origin && filters.destination && filters.date);

  useEffect(() => {
    let isMounted = true;

    if (!hasRequiredFilters) {
      setSchedules([]);
      setErrorMessage('');
      return () => {
        isMounted = false;
      };
    }

    const loadSchedules = async () => {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const responseData = await fetchSchedules({
          origin: filters.origin,
          destination: filters.destination,
          date: filters.date,
        });

        if (!isMounted) {
          return;
        }

        setSchedules(normalizeSchedules(responseData));
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = typeof error === 'string' ? error : 'Unable to load flights. Please try again.';
        setErrorMessage(message);
        setSchedules([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadSchedules();

    return () => {
      isMounted = false;
    };
  }, [filters.date, filters.destination, filters.origin, hasRequiredFilters]);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.3)] sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Search Results</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Available Flights</h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              {filters.origin || 'Origin'} to {filters.destination || 'Destination'} on{' '}
              {filters.date || 'Departure date'}
              {filters.passengers ? ` for ${filters.passengers} passenger(s)` : ''}
            </p>
          </div>

          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Modify Search
          </Link>
        </div>

        {!hasRequiredFilters ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            Missing search filters. Please return to Home and provide origin, destination, and date.
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
            {errorMessage}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-5 py-16 text-sm font-medium text-slate-600">
            Loading flights...
          </div>
        ) : null}

        {!isLoading && !errorMessage && hasRequiredFilters && schedules.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-600">
            No flights found for this search. Try adjusting your route or date.
          </div>
        ) : null}

        {!isLoading && !errorMessage && schedules.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:gap-5">
            {schedules.map((schedule, index) => {
              const key = schedule?.schedule_id ?? `${schedule?.flight_id || 'flight'}-${index}`;
              return <FlightCard key={key} schedule={schedule} />;
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default Results;