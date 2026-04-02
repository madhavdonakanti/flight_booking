import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useBookingStore from '../store/useBookingStore';

function CustomerLogin() {
  const navigate = useNavigate();
  const setUserDetails = useBookingStore((state) => state.setUserDetails);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  });
  const [formError, setFormError] = useState('');

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

  const handleSubmit = (event) => {
    event.preventDefault();

    const normalizedDetails = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
    };

    if (!normalizedDetails.name || !normalizedDetails.email || !normalizedDetails.phone) {
      setFormError('Please enter name, email, and phone to continue.');
      return;
    }

    setUserDetails(normalizedDetails);
    navigate('/home');
  };

  return (
    <section className="mx-auto flex min-h-[calc(100vh-84px)] w-full max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.35)] sm:p-10">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Customer Access</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Guest Details</h2>
          <p className="mt-2 text-sm text-slate-600">
            Provide your details to continue with booking. No sign in is required.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Name</span>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
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
              className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
              required
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</span>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
              required
            />
          </label>

          {formError ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700"
            >
              {formError}
            </p>
          ) : null}

          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-sky-600 px-6 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            Continue to Home
          </button>
        </form>
      </div>
    </section>
  );
}

export default CustomerLogin;