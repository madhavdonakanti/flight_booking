import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/';
const USE_MOCK_DATA_ON_ERROR = import.meta.env.VITE_USE_MOCK_DATA_ON_ERROR !== 'false';
const SEAT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const mockScheduleAircraftMap = new Map();

const createRandomBookingId = () => {
  return String(Math.floor(1000000000 + Math.random() * 9000000000));
};

const ensureBookingId = (booking) => {
  if (!booking || typeof booking !== 'object') {
    return {
      booking_id: createRandomBookingId(),
    };
  }

  if (booking.booking_id != null && String(booking.booking_id).trim()) {
    return booking;
  }

  return {
    ...booking,
    booking_id: createRandomBookingId(),
  };
};

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const adminToken = localStorage.getItem('adminToken');
    const token = localStorage.getItem('jwtToken');
    const isAdminEndpoint = config.url && (config.url.startsWith('admin/') || config.url.startsWith('/admin/'));

    if (isAdminEndpoint) {
      if (adminToken) {
        config.headers.Authorization = `Bearer ${adminToken}`;
      }
    } else if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

const toIsoDateString = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createIsoDateTime = (dateString, hour, minute) => {
  const safeHour = String(hour).padStart(2, '0');
  const safeMinute = String(minute).padStart(2, '0');
  return `${dateString}T${safeHour}:${safeMinute}:00Z`;
};

const createMockSchedules = ({ origin, destination, date }) => {
  const safeOrigin = (origin || 'NYC').trim().toUpperCase();
  const safeDestination = (destination || 'LAX').trim().toUpperCase();
  const today = toIsoDateString(new Date());
  const flightDate = date || today;
  const routeCode = `${safeOrigin}-${safeDestination}`;

  const schedules = [
    {
      schedule_id: 9101,
      departure_time: createIsoDateTime(flightDate, 8, 30),
      arrival_time: createIsoDateTime(flightDate, 11, 45),
      flight_id: 5101,
      aircraft_id: 201,
      flight: { route_code: routeCode },
      route_code: routeCode,
    },
    {
      schedule_id: 9102,
      departure_time: createIsoDateTime(flightDate, 13, 15),
      arrival_time: createIsoDateTime(flightDate, 16, 40),
      flight_id: 5102,
      aircraft_id: 202,
      flight: { route_code: routeCode },
      route_code: routeCode,
    },
    {
      schedule_id: 9103,
      departure_time: createIsoDateTime(flightDate, 18, 5),
      arrival_time: createIsoDateTime(flightDate, 21, 35),
      flight_id: 5103,
      aircraft_id: 203,
      flight: { route_code: routeCode },
      route_code: routeCode,
    },
  ];

  schedules.forEach((schedule) => {
    mockScheduleAircraftMap.set(schedule.schedule_id, schedule.aircraft_id);
  });

  return schedules;
};

const createMockSeatsForAircraft = (aircraftId) => {
  const numericAircraftId = Number(aircraftId) || 200;
  const seats = [];

  for (let row = 1; row <= 20; row += 1) {
    for (let colIndex = 0; colIndex < SEAT_LETTERS.length; colIndex += 1) {
      const seatLetter = SEAT_LETTERS[colIndex];
      seats.push({
        seat_id: numericAircraftId * 1000 + row * 10 + (colIndex + 1),
        seat_number: `${row}${seatLetter}`,
        seat_class: row <= 3 ? 'business' : 'economy',
        aircraft_id: numericAircraftId,
      });
    }
  }

  return seats;
};

const createMockBookedSeatIds = (scheduleId, aircraftId) => {
  const numericScheduleId = Number(scheduleId) || 1;
  const numericAircraftId = Number(aircraftId) || 200;
  const seatOffset = numericScheduleId % 3;
  const base = numericAircraftId * 1000;

  return [base + 11 + seatOffset, base + 24 + seatOffset, base + 37 + seatOffset];
};

const createMockBookingForUser = ({ name, email, phone }) => {
  return {
    booking_id: createRandomBookingId(),
    booking_date: new Date().toISOString(),
    total_amount: 650,
    status: 'confirmed',
    user: {
      name,
      email,
      phone,
    },
    seats: ['12A', '12B'],
    schedule_id: 9101,
    source: 'mock',
  };
};

const shouldUseMockFallback = (error) => {
  return USE_MOCK_DATA_ON_ERROR && !error?.response;
};

const logMockFallback = (operationName, error) => {
  console.warn(`[apiService] ${operationName} failed. Falling back to mock data.`, error);
};

const getFriendlyErrorMessage = (error, fallbackMessage) => {
  const responseData = error?.response?.data;
  const responseMessage =
    responseData?.detail || responseData?.message || responseData?.error || null;

  if (typeof responseMessage === 'string' && responseMessage.trim()) {
    return responseMessage;
  }

  return fallbackMessage;
};

const handleApiError = (operationName, error, fallbackMessage) => {
  console.error(`[apiService] ${operationName} failed:`, error);
  throw getFriendlyErrorMessage(error, fallbackMessage);
};

const getLoweredApiErrorMessage = (error) => {
  const responseData = error?.response?.data;
  const responseMessage =
    responseData?.detail || responseData?.message || responseData?.error || '';

  return typeof responseMessage === 'string' ? responseMessage.trim().toLowerCase() : '';
};

const isPaymentFailureRejection = (error) => {
  const status = error?.response?.status;
  const loweredMessage = getLoweredApiErrorMessage(error);

  const hasPaymentFailureMessage =
    loweredMessage.includes('payment') ||
    loweredMessage.includes('card') ||
    loweredMessage.includes('declin') ||
    loweredMessage.includes('insufficient') ||
    loweredMessage.includes('authorization') ||
    loweredMessage.includes('expired') ||
    loweredMessage.includes('cvv');

  return status === 402 || (status === 400 && hasPaymentFailureMessage);
};

const isSeatAvailabilityRejection = (error) => {
  const status = error?.response?.status;
  const loweredMessage = getLoweredApiErrorMessage(error);

  const hasSeatAvailabilityMessage =
    loweredMessage.includes('seat') &&
    (loweredMessage.includes('booked') ||
      loweredMessage.includes('available') ||
      loweredMessage.includes('taken') ||
      loweredMessage.includes('unavailable'));

  return status === 409 || hasSeatAvailabilityMessage;
};

export const fetchSchedules = async ({ origin, destination, date }) => {
  try {
    const { data } = await apiClient.get('schedules/', {
      params: {
        origin,
        destination,
        date,
      },
    });

    return data;
  } catch (error) {
    if (shouldUseMockFallback(error)) {
      logMockFallback('fetchSchedules', error);
      return createMockSchedules({ origin, destination, date });
    }

    handleApiError('fetchSchedules', error, 'Unable to fetch flight schedules. Please try again.');
  }
};

export const fetchSeatsByAircraftId = async (aircraftId) => {
  try {
    const { data } = await apiClient.get('seats/', {
      params: {
        aircraft_id: aircraftId,
      },
    });

    return data;
  } catch (error) {
    if (shouldUseMockFallback(error)) {
      logMockFallback('fetchSeatsByAircraftId', error);
      return createMockSeatsForAircraft(aircraftId);
    }

    handleApiError('fetchSeatsByAircraftId', error, 'Unable to fetch seat map. Please try again.');
  }
};

export const fetchBookedSeatIdsByScheduleId = async (scheduleId) => {
  try {
    const { data } = await apiClient.get('tickets/', {
      params: {
        schedule_id: scheduleId,
      },
    });

    const tickets = Array.isArray(data) ? data : data?.results ?? [];
    return tickets.map((ticket) => ticket.seat_id);
  } catch (error) {
    if (shouldUseMockFallback(error)) {
      logMockFallback('fetchBookedSeatIdsByScheduleId', error);
      const mappedAircraftId = mockScheduleAircraftMap.get(Number(scheduleId)) || 201;
      return createMockBookedSeatIds(scheduleId, mappedAircraftId);
    }

    handleApiError(
      'fetchBookedSeatIdsByScheduleId',
      error,
      'Unable to fetch unavailable seats. Please try again.'
    );
  }
};

export const submitFinalBooking = async ({
  user,
  passengers,
  selectedScheduleId,
  selectedSeatAssignments,
}) => {
  const normalizedSeatAssignments = Array.isArray(selectedSeatAssignments)
    ? selectedSeatAssignments
      .filter(
        (entry) => Number.isInteger(entry?.passengerIndex) && entry?.seatId != null
      )
      .map((entry) => ({
        passenger_index: entry.passengerIndex,
        seat_id: entry.seatId,
      }))
      .sort((a, b) => a.passenger_index - b.passenger_index)
    : [];

  const seatIds = normalizedSeatAssignments.map((entry) => entry.seat_id);

  try {
    const payload = {
      user,
      passengers,
      schedule_id: selectedScheduleId,
      seat_ids: seatIds,
      seat_assignments: normalizedSeatAssignments,
    };

    const { data } = await apiClient.post('bookings/finalize/', payload);
    return ensureBookingId(data);
  } catch (error) {
    if (isPaymentFailureRejection(error)) {
      throw {
        type: 'PAYMENT_FAILED',
        message: 'Your card was declined. Please try another payment method.',
      };
    }

    if (isSeatAvailabilityRejection(error)) {
      throw {
        type: 'SEAT_TAKEN',
        message: 'One of your selected seats was just booked by someone else.',
      };
    }

    if (shouldUseMockFallback(error)) {
      logMockFallback('submitFinalBooking', error);

      return {
        booking_id: createRandomBookingId(),
        booking_date: new Date().toISOString(),
        total_amount: seatIds.length * 150,
        status: 'confirmed',
        source: 'mock',
      };
    }

    handleApiError('submitFinalBooking', error, 'Unable to complete booking. Please try again.');
  }
};

export const fetchBookingsByUser = async ({ name, email, phone }) => {
  try {
    const { data } = await apiClient.get('bookings/', {
      params: {
        name,
        email,
        phone,
      },
    });

    const bookings = Array.isArray(data) ? data : data?.results ?? [];
    return bookings.map((booking) => ensureBookingId(booking));
  } catch (error) {
    if (shouldUseMockFallback(error)) {
      logMockFallback('fetchBookingsByUser', error);
      return [createMockBookingForUser({ name, email, phone })];
    }

    handleApiError('fetchBookingsByUser', error, 'Unable to fetch bookings. Please try again.');
  }
};

export const loginUser = async (email, password) => {
  try {
    const { data } = await apiClient.post('auth/login/', { email, password });
    return data;
  } catch (error) {
    handleApiError('loginUser', error, 'Invalid email or password.');
  }
};

export const registerUser = async ({ name, email, phone, password }) => {
  try {
    const { data } = await apiClient.post('auth/register/', { name, email, phone, password });
    return data;
  } catch (error) {
    handleApiError('registerUser', error, 'Unable to complete registration. Please check fields.');
  }
};

export const fetchMyBookings = async () => {
  try {
    const { data } = await apiClient.get('bookings/my-bookings/');
    const bookings = Array.isArray(data) ? data : data?.results ?? [];
    return bookings.map((booking) => ensureBookingId(booking));
  } catch (error) {
    handleApiError('fetchMyBookings', error, 'Unable to fetch your account bookings.');
  }
};

export const lookupPNRBooking = async (bookingId, email) => {
  try {
    const { data } = await apiClient.get('bookings/lookup/', {
      params: {
        booking_id: bookingId,
        email: email.trim().toLowerCase(),
      },
    });
    const bookings = Array.isArray(data) ? data : data?.results ?? [];
    return bookings.map((booking) => ensureBookingId(booking));
  } catch (error) {
    if (shouldUseMockFallback(error)) {
      logMockFallback('lookupPNRBooking', error);
      return [createMockBookingForUser({ name: 'Guest', email, phone: '' })];
    }
    handleApiError('lookupPNRBooking', error, 'No booking matching that Booking ID and Email was found.');
  }
};

export const loginAdmin = async (email, password) => {
  try {
    const { data } = await apiClient.post('admin/login/', { email, password });
    return data;
  } catch (error) {
    handleApiError('loginAdmin', error, 'Invalid employee credentials.');
  }
};

export const fetchAdminAircraft = async () => {
  try {
    const { data } = await apiClient.get('admin/aircraft/');
    return data;
  } catch (error) {
    handleApiError('fetchAdminAircraft', error, 'Unable to fetch aircraft list.');
  }
};

export const createAdminAircraft = async (aircraftData) => {
  try {
    const { data } = await apiClient.post('admin/aircraft/', aircraftData);
    return data;
  } catch (error) {
    handleApiError('createAdminAircraft', error, 'Unable to create aircraft.');
  }
};

export const deleteAdminAircraft = async (aircraftId) => {
  try {
    const { data } = await apiClient.delete(`admin/aircraft/${aircraftId}/`);
    return data;
  } catch (error) {
    handleApiError('deleteAdminAircraft', error, 'Unable to delete aircraft.');
  }
};

export const fetchAdminSchedules = async () => {
  try {
    const { data } = await apiClient.get('admin/schedules/');
    return data;
  } catch (error) {
    handleApiError('fetchAdminSchedules', error, 'Unable to fetch admin schedules.');
  }
};

export const createAdminSchedule = async (scheduleData) => {
  try {
    const { data } = await apiClient.post('admin/schedules/', scheduleData);
    return data;
  } catch (error) {
    handleApiError('createAdminSchedule', error, 'Unable to create schedule.');
  }
};

export const deleteAdminSchedule = async (scheduleId) => {
  try {
    const { data } = await apiClient.delete(`admin/schedules/${scheduleId}/`);
    return data;
  } catch (error) {
    handleApiError('deleteAdminSchedule', error, 'Unable to delete schedule.');
  }
};

export const fetchAdminBookings = async () => {
  try {
    const { data } = await apiClient.get('admin/bookings/');
    return data;
  } catch (error) {
    handleApiError('fetchAdminBookings', error, 'Unable to fetch admin bookings.');
  }
};

export const updateAdminBookingStatus = async (bookingId, status, notes) => {
  try {
    const { data } = await apiClient.put(`admin/bookings/${bookingId}/status/`, { status, notes });
    return data;
  } catch (error) {
    handleApiError('updateAdminBookingStatus', error, 'Unable to update booking status.');
  }
};

export const fetchAdminAuditLogs = async () => {
  try {
    const { data } = await apiClient.get('admin/audit-logs/');
    return data;
  } catch (error) {
    handleApiError('fetchAdminAuditLogs', error, 'Unable to fetch audit logs.');
  }
};

export default apiClient;