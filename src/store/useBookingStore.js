import { create } from 'zustand';

const getInitialState = () => ({
  selectedSchedule: null,
  selectedScheduleId: null,
  passengers: [],
  selectedSeatIds: [],
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
    });
  },

  addPassenger: (passenger) => {
    set((state) => ({
      passengers: [...state.passengers, passenger],
    }));
  },

  setPassengers: (passengers) => {
    set({ passengers });
  },

  removePassenger: (passengerIndex) => {
    set((state) => ({
      passengers: state.passengers.filter((_, index) => index !== passengerIndex),
    }));
  },

  toggleSeatSelection: (seatId) => {
    set((state) => {
      const isSelected = state.selectedSeatIds.includes(seatId);

      return {
        selectedSeatIds: isSelected
          ? state.selectedSeatIds.filter((id) => id !== seatId)
          : [...state.selectedSeatIds, seatId],
      };
    });
  },

  getTotalPrice: () => get().selectedSeatIds.length * 150,

  clearCart: () => {
    set(getInitialState());
  },
}));

export default useBookingStore;