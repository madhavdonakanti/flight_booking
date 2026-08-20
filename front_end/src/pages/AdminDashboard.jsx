import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createAdminAircraft,
  createAdminSchedule,
  deleteAdminAircraft,
  deleteAdminSchedule,
  fetchAdminAircraft,
  fetchAdminAuditLogs,
  fetchAdminBookings,
  fetchAdminSchedules,
  updateAdminBookingStatus,
} from '../api/apiService';
import useBookingStore from '../store/useBookingStore';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const isAdminAuthenticated = useBookingStore((state) => state.isAdminAuthenticated);
  const adminUser = useBookingStore((state) => state.adminUser);
  const adminLogout = useBookingStore((state) => state.adminLogout);

  const roles = adminUser?.roles || [];
  const isAdmin = roles.includes('Admin');

  const [activeTab, setActiveTab] = useState(isAdmin ? 'fleet' : 'bookings');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Data states
  const [aircraftList, setAircraftList] = useState([]);
  const [schedulesList, setSchedulesList] = useState([]);
  const [bookingsList, setBookingsList] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Search / filter states
  const [bookingQuery, setBookingQuery] = useState('');

  // Modals
  const [showAircraftModal, setShowAircraftModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  // Form states
  const [newAircraft, setNewAircraft] = useState({
    manufacturer: '',
    model: '',
    tail_number: '',
    total_capacity: 120,
    manufacture_year: 2022,
  });

  const [newSchedule, setNewSchedule] = useState({
    flight_number: '',
    origin_airport_code: '',
    destination_airport_code: '',
    base_duration_minutes: 300,
    aircraft_id: '',
    departure_time: '',
    arrival_time: '',
    flight_status: 'Scheduled',
  });

  const [statusUpdate, setStatusUpdate] = useState({
    status: 'Cancelled',
    notes: '',
  });

  useEffect(() => {
    if (!isAdminAuthenticated || !adminUser) {
      navigate('/admin/login', { replace: true });
      return;
    }

    loadDashboardData();
  }, [isAdminAuthenticated, adminUser]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isAdmin) {
        const [aircraftData, scheduleData, bookingData, logData] = await Promise.all([
          fetchAdminAircraft().catch(() => []),
          fetchAdminSchedules().catch(() => []),
          fetchAdminBookings().catch(() => []),
          fetchAdminAuditLogs().catch(() => []),
        ]);
        setAircraftList(aircraftData || []);
        setSchedulesList(scheduleData || []);
        setBookingsList(bookingData || []);
        setAuditLogs(logData || []);
      } else {
        const [bookingData, logData] = await Promise.all([
          fetchAdminBookings().catch(() => []),
          fetchAdminAuditLogs().catch(() => []),
        ]);
        setBookingsList(bookingData || []);
        setAuditLogs(logData || []);
      }
    } catch (err) {
      setError('Failed to load portal data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    adminLogout();
    navigate('/admin/login', { replace: true });
  };

  // Aircraft handlers
  const handleCreateAircraft = async (e) => {
    e.preventDefault();
    const currentYear = new Date().getFullYear();
    if (newAircraft.manufacture_year > currentYear) {
      setError('Aircraft manufacture year cannot be in the future.');
      return;
    }

    try {
      await createAdminAircraft(newAircraft);
      setSuccessMsg(`Aircraft ${newAircraft.tail_number} added successfully.`);
      setShowAircraftModal(false);
      setNewAircraft({
        manufacturer: '',
        model: '',
        tail_number: '',
        total_capacity: 120,
        manufacture_year: 2022,
      });
      loadDashboardData();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to add aircraft.');
    }
  };

  const handleDeleteAircraft = async (id) => {
    if (!window.confirm('Are you sure you want to delete this aircraft?')) return;
    try {
      await deleteAdminAircraft(id);
      setSuccessMsg('Aircraft deleted successfully.');
      loadDashboardData();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to delete aircraft.');
    }
  };

  // Schedule handlers
  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (!newSchedule.aircraft_id) {
      setError('Please select an aircraft for the schedule.');
      return;
    }

    const nowMs = Date.now();
    const deptTime = new Date(newSchedule.departure_time).getTime();
    const arrTime = new Date(newSchedule.arrival_time).getTime();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;

    if (deptTime < nowMs - twoDaysMs) {
      setError('Departure time cannot be more than 2 days in the past.');
      return;
    }

    if (arrTime < deptTime - twoDaysMs) {
      setError('Arrival date/time cannot be more than 2 days before departure time.');
      return;
    }

    if (arrTime > deptTime + fiveDaysMs) {
      setError('Arrival date/time cannot be more than 5 days after departure time.');
      return;
    }

    try {
      await createAdminSchedule({
        ...newSchedule,
        aircraft_id: Number(newSchedule.aircraft_id),
      });
      setSuccessMsg(`Flight ${newSchedule.flight_number} scheduled successfully.`);
      setShowScheduleModal(false);
      setNewSchedule({
        flight_number: '',
        origin_airport_code: '',
        destination_airport_code: '',
        base_duration_minutes: 300,
        aircraft_id: '',
        departure_time: '',
        arrival_time: '',
        flight_status: 'Scheduled',
      });
      loadDashboardData();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to create flight schedule.');
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('Are you sure you want to delete this schedule?')) return;
    try {
      await deleteAdminSchedule(id);
      setSuccessMsg('Flight schedule deleted successfully.');
      loadDashboardData();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to delete schedule.');
    }
  };

  // Booking handlers
  const openStatusModal = (booking) => {
    setSelectedBooking(booking);
    setStatusUpdate({
      status: booking.status.toLowerCase() === 'confirmed' ? 'Cancelled' : 'Confirmed',
      notes: '',
    });
    setShowStatusModal(true);
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedBooking) return;

    try {
      await updateAdminBookingStatus(selectedBooking.booking_id, statusUpdate.status, statusUpdate.notes);
      setSuccessMsg(`Booking #${selectedBooking.booking_id} status updated to ${statusUpdate.status}.`);
      setShowStatusModal(false);
      setSelectedBooking(null);
      loadDashboardData();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Failed to update booking status.');
    }
  };

  const filteredBookings = bookingsList.filter((b) => {
    if (!bookingQuery.trim()) return true;
    const q = bookingQuery.toLowerCase();
    return (
      String(b.booking_id).includes(q) ||
      b.user_name.toLowerCase().includes(q) ||
      b.user_email.toLowerCase().includes(q) ||
      b.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-sky-50/30 to-white text-slate-900">
      {/* Top Header Navigation matching Customer Portal */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white font-bold shadow-md shadow-sky-600/20">
              SW
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight text-slate-900">SkyWay Operations Portal</h1>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                    isAdmin
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-sky-100 text-sky-800 border border-sky-200'
                  }`}
                >
                  {isAdmin ? 'System Admin' : 'Staff Agent'}
                </span>
              </div>
              <p className="text-xs text-slate-500">Signed in as {adminUser?.name} ({adminUser?.email})</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadDashboardData}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none"
            >
              Refresh Data
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-rose-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500 focus-visible:outline-none"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Tab Selection Bar */}
        <div className="border-t border-slate-200 bg-slate-50/50">
          <div className="mx-auto flex w-full max-w-7xl gap-2 px-4 sm:px-6 lg:px-8">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setActiveTab('fleet')}
                className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  activeTab === 'fleet'
                    ? 'border-sky-600 text-sky-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Fleet & Schedules
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setActiveTab('bookings')}
              className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === 'bookings'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Customer Bookings ({bookingsList.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
                activeTab === 'audit'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Audit Logs ({auditLogs.length})
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Alerts */}
        {error ? (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-700">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold text-rose-800">Dismiss</button>
          </div>
        ) : null}

        {successMsg ? (
          <div className="mb-6 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-700">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="font-bold text-emerald-800">Dismiss</button>
          </div>
        ) : null}

        {loading ? (
          <div className="py-20 text-center text-sm font-medium text-slate-500">Loading portal records...</div>
        ) : (
          <>
            {/* TAB 1: FLEET & SCHEDULES (ADMIN ONLY) */}
            {activeTab === 'fleet' && isAdmin ? (
              <div className="space-y-8">
                {/* Aircraft Fleet Section */}
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-slate-900">Aircraft Fleet Infrastructure</h2>
                      <p className="text-xs text-slate-500">Manage airplane models, tail numbers, and seating capacities.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAircraftModal(true)}
                      className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-sky-500"
                    >
                      + Add New Aircraft
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="px-4 py-3">ID</th>
                          <th className="px-4 py-3">Tail Number</th>
                          <th className="px-4 py-3">Manufacturer</th>
                          <th className="px-4 py-3">Model</th>
                          <th className="px-4 py-3">Capacity</th>
                          <th className="px-4 py-3">Seats Generated</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {aircraftList.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                              No aircraft registered. Add your first aircraft above.
                            </td>
                          </tr>
                        ) : (
                          aircraftList.map((a) => (
                            <tr key={a.aircraft_id} className="hover:bg-slate-50/80 transition">
                              <td className="px-4 py-3 font-mono font-bold text-slate-500">#{a.aircraft_id}</td>
                              <td className="px-4 py-3 font-semibold text-sky-700">{a.tail_number}</td>
                              <td className="px-4 py-3 text-slate-700">{a.manufacturer}</td>
                              <td className="px-4 py-3 text-slate-900 font-medium">{a.model}</td>
                              <td className="px-4 py-3 text-slate-600">{a.total_capacity} passengers</td>
                              <td className="px-4 py-3 text-emerald-600 font-semibold">{a.total_seats_created} seats</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAircraft(a.aircraft_id)}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Flight Schedules Section */}
                <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight text-slate-900">Flight Schedules & Routes</h2>
                      <p className="text-xs text-slate-500">Schedule flights, assign aircraft, and configure departure times.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowScheduleModal(true)}
                      className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md transition hover:bg-sky-500"
                    >
                      + Create Flight & Schedule
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="px-4 py-3">Schedule ID</th>
                          <th className="px-4 py-3">Flight #</th>
                          <th className="px-4 py-3">Route</th>
                          <th className="px-4 py-3">Aircraft</th>
                          <th className="px-4 py-3">Departure Time</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Tickets Sold</th>
                          <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {schedulesList.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                              No active flight schedules found. Create a flight schedule above.
                            </td>
                          </tr>
                        ) : (
                          schedulesList.map((s) => (
                            <tr key={s.schedule_id} className="hover:bg-slate-50/80 transition">
                              <td className="px-4 py-3 font-mono text-slate-400">#{s.schedule_id}</td>
                              <td className="px-4 py-3 font-bold text-sky-700">{s.flight_number}</td>
                              <td className="px-4 py-3 font-medium text-slate-900">
                                {s.origin_airport_code} ➔ {s.destination_airport_code}
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                {s.aircraft_model} ({s.tail_number})
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                {s.departure_time ? new Date(s.departure_time).toLocaleString() : 'N/A'}
                              </td>
                              <td className="px-4 py-3">
                                <span className="rounded bg-sky-100 px-2 py-0.5 text-sky-800 font-semibold">
                                  {s.flight_status}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-semibold text-emerald-600">{s.tickets_booked} tickets</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSchedule(s.schedule_id)}
                                  className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            ) : null}

            {/* TAB 2: CUSTOMER BOOKINGS (ADMIN & STAFF) */}
            {activeTab === 'bookings' ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-slate-900">Customer Bookings & Passenger Records</h2>
                    <p className="text-xs text-slate-500">Lookup customer reservations, modify statuses, or handle cancellations.</p>
                  </div>

                  <div className="w-full max-w-sm">
                    <input
                      type="text"
                      value={bookingQuery}
                      onChange={(e) => setBookingQuery(e.target.value)}
                      placeholder="Search by Booking ID, Name, Email..."
                      className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Booking ID</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Route & Flight</th>
                        <th className="px-4 py-3">Seats</th>
                        <th className="px-4 py-3">Passengers</th>
                        <th className="px-4 py-3">Total Fare</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredBookings.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                            No matching customer bookings found.
                          </td>
                        </tr>
                      ) : (
                        filteredBookings.map((b) => (
                          <tr key={b.booking_id} className="hover:bg-slate-50/80 transition">
                            <td className="px-4 py-3 font-mono font-bold text-sky-700">#{b.booking_id}</td>
                            <td className="px-4 py-3">
                              <strong className="block text-slate-900">{b.user_name}</strong>
                              <span className="text-[11px] text-slate-500">{b.user_email}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              <span className="font-semibold text-slate-900">{b.flight_number || 'Flight'}</span>
                              <span className="block text-[11px] text-slate-500">{b.route_code}</span>
                            </td>
                            <td className="px-4 py-3 font-mono font-semibold text-emerald-600">
                              {b.seats && b.seats.length > 0 ? b.seats.join(', ') : 'None'}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {b.passengers && b.passengers.length > 0
                                ? b.passengers.map((p) => p.name).join(', ')
                                : '1 Passenger'}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-900">${b.total_price.toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded px-2.5 py-0.5 text-xs font-semibold ${
                                  b.status.toLowerCase() === 'confirmed'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {b.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => openStatusModal(b)}
                                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 shadow-sm transition hover:bg-slate-50"
                              >
                                Change Status
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {/* TAB 3: AUDIT LOGS (ADMIN & STAFF) */}
            {activeTab === 'audit' ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
                <div className="mb-6 border-b border-slate-100 pb-4">
                  <h2 className="text-xl font-semibold tracking-tight text-slate-900">System Audit & Action Logs</h2>
                  <p className="text-xs text-slate-500">
                    Real-time audit log tracking actions executed by system employees on bookings.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3">Booking ID</th>
                        <th className="px-4 py-3">Action Type</th>
                        <th className="px-4 py-3">Notes & Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                            No audit log entries recorded yet.
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log, idx) => (
                          <tr key={log.log_id || idx} className="hover:bg-slate-50/80 transition">
                            <td className="px-4 py-3 text-slate-500">
                              {log.action_timestamp ? new Date(log.action_timestamp).toLocaleString() : 'N/A'}
                            </td>
                            <td className="px-4 py-3">
                              <strong className="block text-slate-900">{log.employee_name}</strong>
                              <span className="text-[11px] text-slate-500">{log.employee_email}</span>
                            </td>
                            <td className="px-4 py-3 font-mono font-bold text-sky-700">#{log.booking_id}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded px-2.5 py-0.5 text-xs font-semibold ${
                                  log.action_type === 'CANCELLED'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                    : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {log.action_type}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{log.notes || 'No details provided'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>

      {/* MODAL 1: ADD AIRCRAFT (ADMIN ONLY) */}
      {showAircraftModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-900">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">Add New Aircraft Fleet</h3>
            <form onSubmit={handleCreateAircraft} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1 uppercase tracking-wider">Manufacturer</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Boeing, Airbus"
                  value={newAircraft.manufacturer}
                  onChange={(e) => setNewAircraft({ ...newAircraft, manufacturer: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 uppercase tracking-wider">Model Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 737-800, A320"
                  value={newAircraft.model}
                  onChange={(e) => setNewAircraft({ ...newAircraft, model: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 uppercase tracking-wider">Tail Number (Registration)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. N101SW"
                  value={newAircraft.tail_number}
                  onChange={(e) => setNewAircraft({ ...newAircraft, tail_number: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 uppercase tracking-wider">Total Capacity</label>
                  <input
                    type="number"
                    required
                    min={10}
                    max={500}
                    value={newAircraft.total_capacity}
                    onChange={(e) => setNewAircraft({ ...newAircraft, total_capacity: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 uppercase tracking-wider">Manufacture Year</label>
                  <input
                    type="number"
                    required
                    min={1900}
                    max={new Date().getFullYear()}
                    value={newAircraft.manufacture_year}
                    onChange={(e) => setNewAircraft({ ...newAircraft, manufacture_year: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAircraftModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-md"
                >
                  Save Aircraft
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* MODAL 2: CREATE SCHEDULE (ADMIN ONLY) */}
      {showScheduleModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto text-slate-900">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">Create Flight & Schedule</h3>
            <form onSubmit={handleCreateSchedule} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 uppercase tracking-wider">Flight Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SW101"
                    value={newSchedule.flight_number}
                    onChange={(e) => setNewSchedule({ ...newSchedule, flight_number: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 uppercase tracking-wider">Assign Aircraft</label>
                  <select
                    required
                    value={newSchedule.aircraft_id}
                    onChange={(e) => setNewSchedule({ ...newSchedule, aircraft_id: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                  >
                    <option value="">Select Aircraft...</option>
                    {aircraftList.map((a) => (
                      <option key={a.aircraft_id} value={a.aircraft_id}>
                        {a.model} ({a.tail_number}) - Cap: {a.total_capacity}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 uppercase tracking-wider">Origin Code</label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    placeholder="JFK"
                    value={newSchedule.origin_airport_code}
                    onChange={(e) => setNewSchedule({ ...newSchedule, origin_airport_code: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-slate-900 uppercase focus:border-sky-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 uppercase tracking-wider">Dest Code</label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    placeholder="LAX"
                    value={newSchedule.destination_airport_code}
                    onChange={(e) => setNewSchedule({ ...newSchedule, destination_airport_code: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-slate-900 uppercase focus:border-sky-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 uppercase tracking-wider">Base Duration (m)</label>
                  <input
                    type="number"
                    required
                    min={30}
                    value={newSchedule.base_duration_minutes}
                    onChange={(e) => setNewSchedule({ ...newSchedule, base_duration_minutes: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 uppercase tracking-wider">Departure Time</label>
                  <input
                    type="datetime-local"
                    required
                    min={new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                    value={newSchedule.departure_time}
                    onChange={(e) => setNewSchedule({ ...newSchedule, departure_time: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 uppercase tracking-wider">Arrival Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={newSchedule.arrival_time}
                    onChange={(e) => setNewSchedule({ ...newSchedule, arrival_time: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-md"
                >
                  Create Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* MODAL 3: UPDATE BOOKING STATUS (ADMIN & STAFF) */}
      {showStatusModal && selectedBooking ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-900">
            <h3 className="text-lg font-semibold tracking-tight text-slate-900">Update Booking #{selectedBooking.booking_id} Status</h3>
            <p className="text-xs text-slate-500 mt-1">
              Customer: {selectedBooking.user_name} ({selectedBooking.user_email})
            </p>

            <form onSubmit={handleUpdateStatus} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1 uppercase tracking-wider">Target Status</label>
                <select
                  value={statusUpdate.status}
                  onChange={(e) => setStatusUpdate({ ...statusUpdate, status: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                >
                  <option value="Confirmed">Confirmed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1 uppercase tracking-wider">Audit Notes / Reason</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Customer requested cancellation due to personal reasons."
                  value={statusUpdate.notes}
                  onChange={(e) => setStatusUpdate({ ...statusUpdate, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-900 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-md"
                >
                  Update & Log Action
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
