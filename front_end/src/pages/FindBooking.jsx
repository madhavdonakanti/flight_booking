import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchBookingsByUser } from '../api/apiService';
import useBookingStore from '../store/useBookingStore';

const formatDateTime = (value) => {
  if (!value) {
    return 'Not available';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
};

function FindBooking() {
  const userDetails = useBookingStore((state) => state.userDetails);

  const [formData, setFormData] = useState({
    name: userDetails?.name || '',
    email: userDetails?.email || '',
    phone: userDetails?.phone || '',
  });
  const [formError, setFormError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);

  const normalizedFormData = useMemo(
    () => ({
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
    }),
    [formData]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (formError) {
      setFormError('');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setHasSearched(true);

    if (!normalizedFormData.name || !normalizedFormData.email || !normalizedFormData.phone) {
      setFormError('Please enter name, email, and phone number to find bookings.');
      setBookings([]);
      return;
    }

    setFormError('');
    setIsLoading(true);

    try {
      const response = await fetchBookingsByUser(normalizedFormData);
      setBookings(Array.isArray(response) ? response : []);
    } catch (error) {
      const message = typeof error === 'string' ? error : 'Unable to fetch bookings. Please try again.';
      setFormError(message);
      setBookings([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.3)] sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Booking Lookup</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Find booking</h2>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Enter your details to retrieve existing bookings.
            </p>
          </div>

          <Link
            to="/home"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Back to Home
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
              required
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
            <input
              type="text"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
              required
            />
          </label>

          <label className="flex flex-col gap-2 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone Number</span>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
              required
            />
          </label>

          {formError ? (
            <p
              role="alert"
              className="md:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
            >
              {formError}
            </p>
          ) : null}

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-sky-600 px-6 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {isLoading ? 'Searching...' : 'Find booking'}
            </button>
          </div>
        </form>

        {hasSearched && !isLoading && bookings.length === 0 && !formError ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
            No bookings found for the provided details.
          </div>
        ) : null}

        {bookings.length > 0 ? (
          <div className="mt-6 space-y-4">
            {bookings.map((booking, index) => {
              const bookingId = booking?.booking_id != null ? String(booking.booking_id) : 'Not available';
              const totalAmount = Number(booking?.total_amount);
              const totalLabel = Number.isFinite(totalAmount)
                ? `$${totalAmount.toFixed(2)}`
                : 'Not available';
              const seats = Array.isArray(booking?.seats) ? booking.seats : [];

              return (
                <article
                  key={`${bookingId}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <h3 className="text-lg font-semibold text-slate-900">Booking #{bookingId}</h3>
                  <div className="mt-3 space-y-1 text-sm text-slate-700">
                    <p>
                      <span className="font-semibold">Date:</span> {formatDateTime(booking?.booking_date)}
                    </p>
                    <p>
                      <span className="font-semibold">Status:</span> {booking?.status || 'Not available'}
                    </p>
                    <p>
                      <span className="font-semibold">Total Amount:</span> {totalLabel}
                    </p>
                    <p>
                      <span className="font-semibold">Seats:</span>{' '}
                      {seats.length > 0 ? seats.join(', ') : 'Not available'}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default FindBooking;
