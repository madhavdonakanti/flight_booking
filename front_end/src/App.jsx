import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import SearchForm from './components/SearchForm';
import Results from './pages/Results';
import PassengerDetails from './pages/PassengerDetails';
import SeatSelection from './pages/SeatSelection';
import CheckoutFlow from './pages/CheckoutFlow';
import Landing from './pages/Landing';
import CustomerLogin from './pages/CustomerLogin';
import PaymentSuccess from './pages/PaymentSuccess';
import FindBooking from './pages/FindBooking';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import useBookingStore from './store/useBookingStore';

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useBookingStore((state) => state.isAuthenticated);
  const userDetails = useBookingStore((state) => state.userDetails);
  const logout = useBookingStore((state) => state.logout);

  const hideNavbar = location.pathname.startsWith('/admin');
  const hideSignInButton = location.pathname === '/' || location.pathname === '/login';

  if (hideNavbar) {
    return null;
  }

  const handleSignOut = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Flight Booking System</p>
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">Customer Portal</h1>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated && userDetails?.name ? (
            <span className="hidden text-xs font-semibold text-slate-600 sm:inline-block">
              Signed in as <strong className="text-slate-900">{userDetails.name}</strong>
            </span>
          ) : null}

          {isAuthenticated ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            >
              Sign Out
            </button>
          ) : !hideSignInButton ? (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
            >
              Sign In / Register
            </button>
          ) : null}
        </div>
      </div>
    </header>
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
            <Route path="/find-booking" element={<FindBooking />} />
            <Route path="/book/passengers" element={<PassengerDetails />} />
            <Route path="/book/seats" element={<SeatSelection />} />
            <Route path="/book/checkout" element={<CheckoutFlow />} />
            <Route path="/success" element={<PaymentSuccess />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;