import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/';
const USE_MOCK_DATA_ON_ERROR = import.meta.env.VITE_USE_MOCK_DATA_ON_ERROR !== 'false';
const SEAT_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const mockScheduleAircraftMap = new Map();

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
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
  selectedSeatIds,
}) => {
  try {
    const payload = {
      user,
      passengers,
      schedule_id: selectedScheduleId,
      seat_ids: selectedSeatIds,
    };

    const { data } = await apiClient.post('bookings/finalize/', payload);
    return data;
  } catch (error) {
    if (shouldUseMockFallback(error)) {
      logMockFallback('submitFinalBooking', error);

      return {
        booking_id: `MOCK-${Date.now()}`,
        booking_date: new Date().toISOString(),
        total_amount: selectedSeatIds.length * 150,
        status: 'confirmed',
        source: 'mock',
      };
    }

    handleApiError('submitFinalBooking', error, 'Unable to complete booking. Please try again.');
  }
};

export default apiClient;