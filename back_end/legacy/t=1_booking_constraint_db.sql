-- ==============================================================================
-- FILE: 02_constraints_t1.sql
-- DESCRIPTION: Adds constraints and triggers for Booking, Financial, and 
--              Temporal logic (t=1 task). Run this after the initial schema.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BOOKING & CAPACITY CONSTRAINTS
-- ------------------------------------------------------------------------------

-- Prevent Double Booking: A seat can only be booked once per schedule
ALTER TABLE TICKET
ADD CONSTRAINT uq_ticket_seat_schedule UNIQUE (seat_id, schedule_id);

-- Seat-Aircraft Consistency: Composite Foreign Keys
-- Ensures the ticket's seat physically belongs to the aircraft
ALTER TABLE TICKET
ADD CONSTRAINT fk_ticket_seat_aircraft
FOREIGN KEY (seat_id, aircraft_id) REFERENCES SEAT(seat_id, aircraft_id);

-- Ensures the ticket's schedule uses that same aircraft
ALTER TABLE TICKET
ADD CONSTRAINT fk_ticket_schedule_aircraft
FOREIGN KEY (schedule_id, aircraft_id) REFERENCES SCHEDULE(schedule_id, aircraft_id);

-- Enforce Aircraft Capacity Trigger
CREATE OR REPLACE FUNCTION enforce_aircraft_capacity()
RETURNS TRIGGER AS $$
DECLARE
    current_ticket_count INT;
    max_capacity INT;
BEGIN
    -- Get current ticket count for this specific schedule
    SELECT COUNT(*) INTO current_ticket_count
    FROM TICKET
    WHERE schedule_id = NEW.schedule_id;

    -- Get the total capacity of the assigned aircraft
    SELECT a.total_capacity INTO max_capacity
    FROM SCHEDULE s
    JOIN AIRCRAFT a ON s.aircraft_id = a.aircraft_id
    WHERE s.schedule_id = NEW.schedule_id;

    -- Prevent insert if capacity is reached
    IF current_ticket_count >= max_capacity THEN
        RAISE EXCEPTION 'Insert failed: Aircraft capacity (%) reached for schedule %', max_capacity, NEW.schedule_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_capacity ON TICKET;
CREATE TRIGGER trg_enforce_capacity
BEFORE INSERT ON TICKET
FOR EACH ROW
EXECUTE FUNCTION enforce_aircraft_capacity();


-- ------------------------------------------------------------------------------
-- 2. FINANCIAL CONSTRAINTS
-- ------------------------------------------------------------------------------

-- Valid Booking Amount: Must be greater than zero
ALTER TABLE BOOKING
ADD CONSTRAINT chk_booking_total_price CHECK (total_price > 0);

-- Exact Payment Match Trigger
CREATE OR REPLACE FUNCTION verify_exact_payment()
RETURNS TRIGGER AS $$
DECLARE
    expected_amount DECIMAL;
BEGIN
    SELECT total_price INTO expected_amount
    FROM BOOKING
    WHERE booking_id = NEW.booking_id;

    IF NEW.amount <> expected_amount THEN
        RAISE EXCEPTION 'Payment failed: Amount (%) does not match booking total (%)', NEW.amount, expected_amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verify_exact_payment ON PAYMENT;
CREATE TRIGGER trg_verify_exact_payment
BEFORE INSERT OR UPDATE ON PAYMENT
FOR EACH ROW
EXECUTE FUNCTION verify_exact_payment();


-- ------------------------------------------------------------------------------
-- 3. TEMPORAL (TIME-BASED) CONSTRAINTS
-- ------------------------------------------------------------------------------

-- Valid Schedule Times: Departure must be before arrival
ALTER TABLE SCHEDULE
ADD CONSTRAINT chk_departure_before_arrival 
CHECK (departure_time < arrival_time);

-- Valid Booking Timeline Trigger
CREATE OR REPLACE FUNCTION verify_booking_timeline()
RETURNS TRIGGER AS $$
DECLARE
    flight_departure TIMESTAMP;
    parent_booking_date TIMESTAMP;
BEGIN
    -- Get the departure time for the schedule being ticketed
    SELECT departure_time INTO flight_departure
    FROM SCHEDULE
    WHERE schedule_id = NEW.schedule_id;

    -- Get the booking date
    SELECT booking_date INTO parent_booking_date
    FROM BOOKING
    WHERE booking_id = NEW.booking_id;

    IF parent_booking_date >= flight_departure THEN
        RAISE EXCEPTION 'Invalid timeline: Booking date must occur before the flight departure time.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verify_booking_timeline ON TICKET;
CREATE TRIGGER trg_verify_booking_timeline
BEFORE INSERT OR UPDATE ON TICKET
FOR EACH ROW
EXECUTE FUNCTION verify_booking_timeline();
