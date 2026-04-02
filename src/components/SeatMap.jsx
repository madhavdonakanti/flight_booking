import useBookingStore from '../store/useBookingStore';

const normalizeId = (value) => String(value);

function SeatMap({ allSeats = [], bookedSeatIds = [] }) {
  const selectedSeatIds = useBookingStore((state) => state.selectedSeatIds);
  const toggleSeatSelection = useBookingStore((state) => state.toggleSeatSelection);

  const bookedSeatSet = new Set(bookedSeatIds.map(normalizeId));
  const selectedSeatSet = new Set(selectedSeatIds.map(normalizeId));

  const sortedSeats = [...allSeats].sort((a, b) => {
    const seatA = a?.seat_number ?? '';
    const seatB = b?.seat_number ?? '';
    return seatA.localeCompare(seatB, undefined, { numeric: true, sensitivity: 'base' });
  });

  const handleSeatClick = (seatId, isBooked) => {
    if (isBooked) {
      return;
    }

    toggleSeatSelection(seatId);
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.35)] sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-slate-900">Choose Your Seats</h3>
          <p className="mt-1 text-sm text-slate-600">Booked seats are unavailable. Select available seats to continue.</p>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-green-500" />
            Available
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-sky-500" />
            Selected
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-slate-400" />
            Booked
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="mx-auto grid min-w-[18rem] grid-cols-6 gap-3 sm:min-w-[28rem]">
          {sortedSeats.map((seat) => {
            const seatId = seat?.seat_id;
            const seatIdKey = normalizeId(seatId);
            const isBooked = bookedSeatSet.has(seatIdKey);
            const isSelected = selectedSeatSet.has(seatIdKey);

            let seatStyle = 'border-green-600 bg-green-500 text-white hover:bg-green-600';

            if (isSelected) {
              seatStyle = 'border-sky-600 bg-sky-500 text-white hover:bg-sky-600';
            }

            if (isBooked) {
              seatStyle = 'cursor-not-allowed border-slate-400 bg-slate-400 text-slate-100';
            }

            return (
              <button
                key={seatIdKey}
                type="button"
                onClick={() => handleSeatClick(seatId, isBooked)}
                disabled={isBooked}
                className={`flex h-14 flex-col items-center justify-center rounded-lg border text-xs font-semibold transition ${seatStyle}`}
                aria-pressed={isSelected && !isBooked}
                aria-label={`Seat ${seat?.seat_number || seatIdKey}`}
              >
                <span>{seat?.seat_number || `Seat ${seatIdKey}`}</span>
                {seat?.seat_class ? (
                  <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wide opacity-90">
                    {seat.seat_class}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default SeatMap;