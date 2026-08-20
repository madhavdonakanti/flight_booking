import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, registerUser } from '../api/apiService';
import useBookingStore from '../store/useBookingStore';

function CustomerLogin() {
  const navigate = useNavigate();
  const loginStore = useBookingStore((state) => state.login);

  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'guest'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (formError) setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (mode === 'guest') {
      navigate('/home');
      return;
    }

    setIsSubmitting(true);
    setFormError('');

    try {
      if (mode === 'login') {
        if (!formData.email || !formData.password) {
          setFormError('Please enter your email and password.');
          setIsSubmitting(false);
          return;
        }
        const res = await loginUser(formData.email.trim(), formData.password);
        if (res && res.token) {
          loginStore(res.user, res.token);
          navigate('/home');
        }
        return;
      }

      if (mode === 'register') {
        const cleanPhone = formData.phone.replace(/\D/g, '');
        if (!formData.name || !formData.email || !cleanPhone || !formData.password) {
          setFormError('Please fill in all registration fields.');
          setIsSubmitting(false);
          return;
        }
        if (cleanPhone.length !== 10) {
          setFormError('Phone number must contain exactly 10 digits.');
          setIsSubmitting(false);
          return;
        }
        if (formData.password.length < 6) {
          setFormError('Password must be at least 6 characters.');
          setIsSubmitting(false);
          return;
        }
        const res = await registerUser({
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: cleanPhone,
          password: formData.password,
        });
        if (res && res.token) {
          loginStore(res.user, res.token);
          navigate('/home');
        }
      }
    } catch (err) {
      setFormError(err?.message || 'An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto flex min-h-[calc(100vh-84px)] w-full max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.35)] sm:p-10">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Flight Booking Access</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {mode === 'login' && 'Sign In to Account'}
            {mode === 'register' && 'Create New Account'}
            {mode === 'guest' && 'Guest Mode Access'}
          </h2>
        </div>

        {/* Tab Selection */}
        <div className="mt-6 flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setFormError('');
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setFormError('');
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              mode === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('guest');
              setFormError('');
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              mode === 'guest' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Guest Mode
          </button>
        </div>

        {mode === 'guest' ? (
          <div className="mt-6 text-center space-y-6">
            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-6 text-left">
              <h3 className="text-base font-semibold text-slate-900">No Account Required</h3>
              <p className="mt-1 text-sm text-slate-600">
                You can search flights, pick seats, and select passengers immediately. We will only ask for your contact details at checkout when issuing your e-ticket.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/home')}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-sky-600 px-6 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              Continue to Flight Search →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' && (
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full Name</span>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Jane Doe"
                  className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
                  required
                />
              </label>
            )}

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email Address</span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@example.com"
                className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
                required
              />
            </label>

            {mode === 'register' && (
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">10-Digit Phone Number</span>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="10 digit number e.g. 9876543210"
                  className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
                  required
                />
              </label>
            )}

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
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
              disabled={isSubmitting}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-sky-600 px-6 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {isSubmitting
                ? 'Processing...'
                : mode === 'login'
                ? 'Sign In'
                : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

export default CustomerLogin;