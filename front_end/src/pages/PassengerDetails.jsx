import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import useBookingStore from '../store/useBookingStore';

const createEmptyPassenger = () => ({
  first_name: '',
  last_name: '',
  passport_number: '',
  birth_date: '',
});

const normalizePassenger = (passenger = {}) => ({
  first_name: passenger.first_name ?? '',
  last_name: passenger.last_name ?? '',
  passport_number: passenger.passport_number ?? '',
  birth_date: passenger.birth_date ?? '',
});

const isPassengerComplete = (passenger) => {
  return Boolean(
    passenger.first_name.trim() &&
      passenger.last_name.trim() &&
      passenger.passport_number.trim() &&
      passenger.birth_date
  );
};

const getPassengerCount = (rawCount, storedCount) => {
  const parsed = Number(rawCount);

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  if (storedCount > 0) {
    return storedCount;
  }

  return 1;
};

function PassengerDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const selectedSchedule = useBookingStore((state) => state.selectedSchedule);
  const storedPassengers = useBookingStore((state) => state.passengers);
  const setPassengers = useBookingStore((state) => state.setPassengers);

  const passengerCount = useMemo(() => {
    return getPassengerCount(searchParams.get('passengers'), storedPassengers.length);
  }, [searchParams, storedPassengers.length]);

  const initialPassengerForms = useMemo(() => {
    const seededPassengers = storedPassengers.slice(0, passengerCount).map(normalizePassenger);

    while (seededPassengers.length < passengerCount) {
      seededPassengers.push(createEmptyPassenger());
    }

    return seededPassengers;
  }, [storedPassengers, passengerCount]);

  const [passengerForms, setPassengerForms] = useState(initialPassengerForms);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [formError, setFormError] = useState('');

  const backToResultsHref = location.search ? `/results${location.search}` : '/results';

  useEffect(() => {
    setPassengerForms(initialPassengerForms);
  }, [initialPassengerForms]);

  useEffect(() => {
    if (!selectedSchedule) {
      navigate('/home', { replace: true });
    }
  }, [selectedSchedule, navigate]);

  if (!selectedSchedule) {
    return null;
  }

  const handlePassengerFieldChange = (index, field, value) => {
    setPassengerForms((prev) =>
      prev.map((passenger, passengerIndex) =>
        passengerIndex === index ? { ...passenger, [field]: value } : passenger
      )
    );

    if (hasSubmitted) {
      setFormError('');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setHasSubmitted(true);

    const normalizedPassengers = passengerForms.map((passenger) => ({
      first_name: passenger.first_name.trim(),
      last_name: passenger.last_name.trim(),
      passport_number: passenger.passport_number.trim(),
      birth_date: passenger.birth_date,
    }));

    const allValid = normalizedPassengers.every(isPassengerComplete);

    if (!allValid) {
      setFormError('Please complete all passenger details before continuing.');
      return;
    }

    setPassengers(normalizedPassengers);
    setFormError('');

    const nextSearch = new URLSearchParams(searchParams);
    nextSearch.set('passengers', String(passengerCount));

    const queryString = nextSearch.toString();
    navigate(queryString ? `/book/seats?${queryString}` : '/book/seats');
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.3)] sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Booking Flow</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
              Passenger Details
            </h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Enter details for {passengerCount} passenger{passengerCount > 1 ? 's' : ''}.
            </p>
          </div>

          <Link
            to={backToResultsHref}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Back to Results
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4">
            {passengerForms.map((passenger, index) => {
              const firstNameInvalid = hasSubmitted && !passenger.first_name.trim();
              const lastNameInvalid = hasSubmitted && !passenger.last_name.trim();
              const passportInvalid = hasSubmitted && !passenger.passport_number.trim();
              const birthDateInvalid = hasSubmitted && !passenger.birth_date;

              return (
                <article
                  key={`passenger-${index}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
                >
                  <h3 className="text-lg font-semibold text-slate-900">Passenger {index + 1}</h3>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        First Name
                      </span>
                      <input
                        type="text"
                        value={passenger.first_name}
                        onChange={(event) =>
                          handlePassengerFieldChange(index, 'first_name', event.target.value)
                        }
                        className={`h-11 rounded-xl border bg-white px-4 text-slate-900 outline-none transition focus:ring-2 ${
                          firstNameInvalid
                            ? 'border-rose-500 ring-rose-500 focus:border-rose-500 focus:ring-rose-500'
                            : 'border-slate-300 ring-sky-500 focus:border-sky-500 focus:ring-sky-500'
                        }`}
                        aria-invalid={firstNameInvalid}
                        required
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Last Name
                      </span>
                      <input
                        type="text"
                        value={passenger.last_name}
                        onChange={(event) =>
                          handlePassengerFieldChange(index, 'last_name', event.target.value)
                        }
                        className={`h-11 rounded-xl border bg-white px-4 text-slate-900 outline-none transition focus:ring-2 ${
                          lastNameInvalid
                            ? 'border-rose-500 ring-rose-500 focus:border-rose-500 focus:ring-rose-500'
                            : 'border-slate-300 ring-sky-500 focus:border-sky-500 focus:ring-sky-500'
                        }`}
                        aria-invalid={lastNameInvalid}
                        required
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Passport Number
                      </span>
                      <input
                        type="text"
                        value={passenger.passport_number}
                        onChange={(event) =>
                          handlePassengerFieldChange(index, 'passport_number', event.target.value)
                        }
                        className={`h-11 rounded-xl border bg-white px-4 text-slate-900 outline-none transition focus:ring-2 ${
                          passportInvalid
                            ? 'border-rose-500 ring-rose-500 focus:border-rose-500 focus:ring-rose-500'
                            : 'border-slate-300 ring-sky-500 focus:border-sky-500 focus:ring-sky-500'
                        }`}
                        aria-invalid={passportInvalid}
                        required
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Birth Date
                      </span>
                      <input
                        type="date"
                        value={passenger.birth_date}
                        onChange={(event) =>
                          handlePassengerFieldChange(index, 'birth_date', event.target.value)
                        }
                        className={`h-11 rounded-xl border bg-white px-4 text-slate-900 outline-none transition focus:ring-2 ${
                          birthDateInvalid
                            ? 'border-rose-500 ring-rose-500 focus:border-rose-500 focus:ring-rose-500'
                            : 'border-slate-300 ring-sky-500 focus:border-sky-500 focus:ring-sky-500'
                        }`}
                        aria-invalid={birthDateInvalid}
                        required
                      />
                    </label>
                  </div>
                </article>
              );
            })}
          </div>

          {formError ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
            >
              {formError}
            </p>
          ) : null}

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-sky-600 px-8 text-sm font-semibold text-white shadow-lg shadow-sky-600/25 transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              Continue to Seats
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default PassengerDetails;