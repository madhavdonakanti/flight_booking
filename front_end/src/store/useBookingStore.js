import { create } from 'zustand';

const BUSINESS_FARE = 500;
const ECONOMY_FARE = 150;

const getSeatClassFare = (seatClass) => {
  if (typeof seatClass === 'string' && seatClass.trim().toLowerCase() === 'business') {
    return BUSINESS_FARE;
  }

  return ECONOMY_FARE;
};

const getStoredToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('jwtToken') || null;
  }
  return null;
};

const getStoredAdminToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('adminToken') || null;
  }
  return null;
};

const getStoredAdminUser = () => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('adminUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  return null;
};

const getInitialState = () => ({
  selectedSchedule: null,
  selectedScheduleId: null,
  userDetails: null,
  lastBooking: null,
  passengers: [],
  selectedSeatIds: [],
  allSeats: [],
  token: getStoredToken(),
  isAuthenticated: Boolean(getStoredToken()),
  adminToken: getStoredAdminToken(),
  adminUser: getStoredAdminUser(),
  isAdminAuthenticated: Boolean(getStoredAdminToken()),
});

const useBookingStore = create((set, get) => ({
  ...getInitialState(),

  setSchedule: (schedule) => {
    if (!schedule || typeof schedule !== 'object' || schedule.schedule_id == null) {
      console.error('[useBookingStore] setSchedule requires a full schedule object with schedule_id.');
      return;
    }

    set({
      selectedSchedule: schedule,
      selectedScheduleId: schedule.schedule_id,
      selectedSeatIds: [],
      allSeats: [],
    });
  },

  setUserDetails: (details) => {
    if (!details || typeof details !== 'object') {
      set({ userDetails: null });
      return;
    }

    set({
      userDetails: {
        name: String(details.name ?? '').trim(),
        email: String(details.email ?? '').trim(),
        phone: String(details.phone ?? '').trim(),
      },
    });
  },

  setLastBooking: (booking) => {
    if (!booking || typeof booking !== 'object') {
      set({ lastBooking: null });
      return;
    }

    set({ lastBooking: booking });
  },

  addPassenger: (passenger) => {
    set((state) => ({
      passengers: [...state.passengers, passenger],
    }));
  },

  setPassengers: (passengers) => {
    set((state) => ({
      passengers,
      selectedSeatIds: state.selectedSeatIds.filter(
        (assignment) =>
          Number.isInteger(assignment?.passengerIndex) && assignment.passengerIndex < passengers.length
      ),
    }));
  },

  removePassenger: (passengerIndex) => {
    set((state) => ({
      passengers: state.passengers.filter((_, index) => index !== passengerIndex),
    }));
  },

  setAllSeats: (allSeats) => {
    set({ allSeats: Array.isArray(allSeats) ? allSeats : [] });
  },

  toggleSeatSelection: (passengerIndex, seatId) => {
    const { selectedSeatIds, passengers } = get();
    if (!Number.isInteger(passengerIndex) || passengerIndex < 0 || passengerIndex >= passengers.length) {
      return;
    }

    const currentPassengerAssignment = selectedSeatIds.find(
      (assignment) => assignment.passengerIndex === passengerIndex
    );
    const isSelected = currentPassengerAssignment?.seatId === seatId;

    if (isSelected) {
      set({
        selectedSeatIds: selectedSeatIds.filter(
          (assignment) => assignment.passengerIndex !== passengerIndex
        ),
      });
      return;
    }

    const isSeatAssignedToAnotherPassenger = selectedSeatIds.some(
      (assignment) => assignment.seatId === seatId && assignment.passengerIndex !== passengerIndex
    );

    if (isSeatAssignedToAnotherPassenger) {
      if (typeof window !== 'undefined') {
        window.alert('This seat is already assigned to another passenger.');
      }
      return;
    }

    const nextAssignments = selectedSeatIds.filter(
      (assignment) => assignment.passengerIndex !== passengerIndex
    );

    nextAssignments.push({ passengerIndex, seatId });

    set({
      selectedSeatIds: nextAssignments,
    });
  },

  getTotalPrice: () => {
    const { selectedSeatIds, allSeats } = get();

    if (selectedSeatIds.length === 0) {
      return 0;
    }

    const seatById = new Map(
      allSeats
        .filter((seat) => seat?.seat_id != null)
        .map((seat) => [String(seat.seat_id), seat])
    );

    return selectedSeatIds.reduce((sum, assignment) => {
      const matchingSeat = seatById.get(String(assignment?.seatId));
      return sum + getSeatClassFare(matchingSeat?.seat_class);
    }, 0);
  },

  clearBookingProgress: () => {
    set({
      selectedSchedule: null,
      selectedScheduleId: null,
      passengers: [],
      selectedSeatIds: [],
      allSeats: [],
    });
  },

  clearCart: () => {
    set(getInitialState());
  },

  login: (userData, token) => {
    if (typeof window !== 'undefined' && token) {
      localStorage.setItem('jwtToken', token);
    }
    set({
      token,
      isAuthenticated: true,
      userDetails: userData
        ? {
            name: userData.name || '',
            email: userData.email || '',
            phone: userData.phone || '',
          }
        : get().userDetails,
    });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('jwtToken');
    }
    set(getInitialState());
  },

  adminLogin: (employeeData, token) => {
    if (typeof window !== 'undefined' && token) {
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminUser', JSON.stringify(employeeData));
    }
    set({
      adminToken: token,
      adminUser: employeeData,
      isAdminAuthenticated: true,
    });
  },

  adminLogout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
    }
    set({
      adminToken: null,
      adminUser: null,
      isAdminAuthenticated: false,
    });
  },
}));

export default useBookingStore;