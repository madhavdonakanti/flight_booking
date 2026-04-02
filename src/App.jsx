import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import SearchForm from './components/SearchForm';
import Results from './pages/Results';
import PassengerDetails from './pages/PassengerDetails';
import SeatSelection from './pages/SeatSelection';
import CheckoutFlow from './pages/CheckoutFlow';
import Landing from './pages/Landing';
import CustomerLogin from './pages/CustomerLogin';
import PaymentSuccess from './pages/PaymentSuccess';
import useBookingStore from './store/useBookingStore';

function Navbar() {
  const navigate = useNavigate();
  const clearCart = useBookingStore((state) => state.clearCart);

  const handleSignOut = () => {
    clearCart();
    navigate('/', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Flight Booking System</p>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Customer and Admin Portal</h1>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          Sign Out
        </button>
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
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<CustomerLogin />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/results" element={<Results />} />
            <Route path="/book/passengers" element={<PassengerDetails />} />
            <Route path="/book/seats" element={<SeatSelection />} />
            <Route path="/book/checkout" element={<CheckoutFlow />} />
            <Route path="/success" element={<PaymentSuccess />} />
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