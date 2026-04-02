import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import SearchForm from './components/SearchForm';
import Results from './pages/Results';
import PassengerDetails from './pages/PassengerDetails';
import SeatSelection from './pages/SeatSelection';
import CheckoutFlow from './pages/CheckoutFlow';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/results', label: 'Results' },
  { to: '/book/passengers', label: 'Passengers' },
  { to: '/book/seats', label: 'Seats' },
  { to: '/book/checkout', label: 'Checkout' },
  { to: '/admin', label: 'Admin' },
];

const navLinkClassName = ({ isActive }) => {
  const baseClass = 'rounded-lg px-3 py-2 text-sm font-medium transition';
  const stateClass = isActive
    ? 'bg-sky-100 text-sky-700'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';

  return `${baseClass} ${stateClass}`;
};

function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Flight Booking System</p>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Customer and Admin Portal</h1>
        </div>

        <nav className="flex flex-wrap items-center gap-1" aria-label="Primary">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={navLinkClassName} end={item.to === '/'}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

function PagePlaceholder({ title, description }) {
  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.35)] sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">{description}</p>
      </div>
    </section>
  );
}

function HomePage() {
  return <SearchForm />;
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-sky-50/30 to-white text-slate-900">
        <Navbar />

        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/results" element={<Results />} />
            <Route path="/book/passengers" element={<PassengerDetails />} />
            <Route path="/book/seats" element={<SeatSelection />} />
            <Route path="/book/checkout" element={<CheckoutFlow />} />
            <Route
              path="/admin"
              element={
                <PagePlaceholder
                  title="Admin Portal"
                  description="Manage fleet, schedules, and booking records from this dashboard."
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;