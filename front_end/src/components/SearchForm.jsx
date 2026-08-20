import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const initialFormData = {
  origin: '',
  destination: '',
  departureDate: '',
  passengers: 1,
};

function SearchForm() {
  const [formData, setFormData] = useState(initialFormData);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue = name === 'passengers' ? Math.max(1, Number(value) || 1) : value;
    const nextFormData = {
      ...formData,
      [name]: nextValue,
    };

    setFormData(nextFormData);

    if (hasSubmitted && nextFormData.origin.trim() && nextFormData.destination.trim()) {
      setFormError('');
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    setHasSubmitted(true);

    const trimmedOrigin = formData.origin.trim();
    const trimmedDestination = formData.destination.trim();

    if (!trimmedOrigin || !trimmedDestination) {
      setFormError('Please enter a valid origin and destination.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (formData.departureDate && formData.departureDate < todayStr) {
      setFormError('Departure date cannot be in the past.');
      return;
    }

    setFormError('');

    const searchParams = new URLSearchParams({
      origin: trimmedOrigin,
      dest: trimmedDestination,
      date: formData.departureDate,
      passengers: String(Number(formData.passengers)),
    });

    navigate(`/results?${searchParams.toString()}`);
  };

  const isOriginInvalid = hasSubmitted && !formData.origin.trim();
  const isDestinationInvalid = hasSubmitted && !formData.destination.trim();

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_-15px_rgba(15,23,42,0.25)]">
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-sky-500/15 via-cyan-400/15 to-teal-400/15" />

        <div className="relative p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Search Flights
            </h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Find the best routes and fares for your next trip.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Origin
                </span>
                <input
                  type="text"
                  name="origin"
                  value={formData.origin}
                  onChange={handleChange}
                  placeholder="City or airport"
                  className={`h-12 rounded-xl border bg-white px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 ${
                    isOriginInvalid
                      ? 'border-rose-500 ring-rose-500 focus:border-rose-500 focus:ring-rose-500'
                      : 'border-slate-300 ring-sky-500 focus:border-sky-500 focus:ring-sky-500'
                  }`}
                  aria-invalid={isOriginInvalid}
                  required
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Destination
                </span>
                <input
                  type="text"
                  name="destination"
                  value={formData.destination}
                  onChange={handleChange}
                  placeholder="City or airport"
                  className={`h-12 rounded-xl border bg-white px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 ${
                    isDestinationInvalid
                      ? 'border-rose-500 ring-rose-500 focus:border-rose-500 focus:ring-rose-500'
                      : 'border-slate-300 ring-sky-500 focus:border-sky-500 focus:ring-sky-500'
                  }`}
                  aria-invalid={isDestinationInvalid}
                  required
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Departure Date
                </span>
                <input
                  type="date"
                  name="departureDate"
                  min={new Date().toISOString().split('T')[0]}
                  value={formData.departureDate}
                  onChange={handleChange}
                  className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
                  required
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Passengers
                </span>
                <input
                  type="number"
                  name="passengers"
                  value={formData.passengers}
                  onChange={handleChange}
                  min="1"
                  className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
                  required
                />
              </label>
            </div>

            {formError ? (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
              >
                {formError}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <Link
                to="/find-booking"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                Find booking
              </Link>

              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-sky-600 px-8 text-sm font-semibold text-white shadow-lg shadow-sky-600/25 transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              >
                Search Flights
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

export default SearchForm;