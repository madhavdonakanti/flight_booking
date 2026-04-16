const normalizeId = (value) => String(value);
const formatSeatClassLabel = (seatClass) => {
  if (typeof seatClass !== 'string' || !seatClass.trim()) {
    return 'Economy';
  }

  const normalized = seatClass.trim().toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

function SeatMap({ allSeats = [], bookedSeatIds = [], selectedSeatIds = [], onSeatHover, onSeatSelect }) {
  const bookedSeatSet = new Set(bookedSeatIds.map(normalizeId));
  const selectedSeatSet = new Set(selectedSeatIds.map(normalizeId));

  const sortedSeats = [...allSeats].sort((a, b) => {
    const seatA = a?.seat_number ?? '';
    const seatB = b?.seat_number ?? '';
    return seatA.localeCompare(seatB, undefined, { numeric: true, sensitivity: 'base' });
  });

  const handleSeatHover = (seat) => {
    if (typeof onSeatHover === 'function') {
      onSeatHover(seat);
    }
  };

  const handleSeatClick = (seat, isBooked) => {
    if (isBooked) {
      return;
    }

    if (typeof onSeatSelect === 'function') {
      onSeatSelect(seat);
    }
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
                onClick={() => handleSeatClick(seat, isBooked)}
                onMouseEnter={() => handleSeatHover(seat)}
                onFocus={() => handleSeatHover(seat)}
                disabled={isBooked}
                className={`flex h-14 flex-col items-center justify-center rounded-lg border text-xs font-semibold transition ${seatStyle}`}
                aria-pressed={isSelected && !isBooked}
                aria-label={`Seat ${seat?.seat_number || seatIdKey}`}
                title={`${seat?.seat_number || `Seat ${seatIdKey}`} | ${formatSeatClassLabel(seat?.seat_class)}`}
              >
                <span>{seat?.seat_number || `Seat ${seatIdKey}`}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default SeatMap;