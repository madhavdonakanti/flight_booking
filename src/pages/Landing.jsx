import { useNavigate } from 'react-router-dom';

function Landing() {
  const navigate = useNavigate();

  const handleCustomerClick = () => {
    navigate('/login');
  };

  const handleAdminClick = () => {
    window.alert('Admin portal is coming soon.');
  };

  return (
    <section className="mx-auto flex min-h-[calc(100vh-84px)] w-full max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.35)] sm:p-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Flight Booking System</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Are you a Customer or an Admin?
          </h2>
          <p className="mt-3 text-sm text-slate-600 sm:text-base">
            Choose your portal to continue.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleCustomerClick}
            className="inline-flex h-20 items-center justify-center rounded-2xl bg-sky-600 px-6 text-lg font-semibold text-white shadow-lg shadow-sky-600/25 transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            Customer
          </button>

          <button
            type="button"
            onClick={handleAdminClick}
            className="inline-flex h-20 items-center justify-center rounded-2xl border border-slate-300 bg-white px-6 text-lg font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            Admin
          </button>
        </div>
      </div>
    </section>
  );
}

export default Landing;