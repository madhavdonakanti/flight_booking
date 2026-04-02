import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function CustomerLogin() {
  const navigate = useNavigate();
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  });

  const handleChange = (event) => {
    const { name, value } = event.target;

    setCredentials((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    navigate('/home');
  };

  return (
    <section className="mx-auto flex min-h-[calc(100vh-84px)] w-full max-w-5xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_70px_-30px_rgba(15,23,42,0.35)] sm:p-10">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Customer Access</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Customer Login</h2>
          <p className="mt-2 text-sm text-slate-600">Demo login. Authentication is not connected yet.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Username</span>
            <input
              type="text"
              name="username"
              value={credentials.username}
              onChange={handleChange}
              className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
              required
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Password</span>
            <input
              type="text"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-slate-900 outline-none ring-sky-500 transition focus:border-sky-500 focus:ring-2"
              required
            />
          </label>

          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-sky-600 px-6 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            Continue to Customer Home
          </button>
        </form>
      </div>
    </section>
  );
}

export default CustomerLogin;