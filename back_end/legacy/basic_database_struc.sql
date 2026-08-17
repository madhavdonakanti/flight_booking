-- ==============================================================================
-- FILE: 01_schema_t0.sql
-- DESCRIPTION: Initial database schema creation for the Flight Booking System.
-- ==============================================================================

-- Drop existing tables to allow clean reruns (Development only)
DROP TABLE IF EXISTS BOOKING_PROCESSING CASCADE;
DROP TABLE IF EXISTS EMPLOYEE_ROLE CASCADE;
DROP TABLE IF EXISTS ROLE CASCADE;
DROP TABLE IF EXISTS EMPLOYEE CASCADE;
DROP TABLE IF EXISTS TICKET CASCADE;
DROP TABLE IF EXISTS SCHEDULE CASCADE;
DROP TABLE IF EXISTS SEAT CASCADE;
DROP TABLE IF EXISTS AIRCRAFT CASCADE;
DROP TABLE IF EXISTS FLIGHT CASCADE;
DROP TABLE IF EXISTS PAYMENT CASCADE;
DROP TABLE IF EXISTS BOOKING_PASSENGER CASCADE;
DROP TABLE IF EXISTS PASSENGER CASCADE;
DROP TABLE IF EXISTS BOOKING CASCADE;
DROP TABLE IF EXISTS TRAVEL_AGENCY CASCADE;
DROP TABLE IF EXISTS "USER" CASCADE;

-- ==========================================
-- 1. CUSTOMERS & BOOKINGS
-- ==========================================

CREATE TABLE "USER" (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    phone_number VARCHAR,
    password_hash VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE TRAVEL_AGENCY (
    agency_id SERIAL PRIMARY KEY,
    agency_name VARCHAR NOT NULL,
    contact_email VARCHAR UNIQUE NOT NULL,
    contact_phone VARCHAR NOT NULL,
    commission_rate DECIMAL NOT NULL -- e.g., 0.05 for 5%
);

CREATE TABLE BOOKING (
    booking_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES "USER"(user_id),
    agency_id INT REFERENCES TRAVEL_AGENCY(agency_id),
    booking_date TIMESTAMP NOT NULL,
    total_price DECIMAL NOT NULL,
    booking_status VARCHAR NOT NULL, -- e.g., 'Confirmed', 'Cancelled'
    
    -- ISA hierarchy flattened: Total participation + disjoint constraint.
    CONSTRAINT chk_booking_owner CHECK (
        (user_id IS NOT NULL AND agency_id IS NULL) OR 
        (user_id IS NULL AND agency_id IS NOT NULL)
    )
);

CREATE TABLE PASSENGER (
    passenger_id SERIAL PRIMARY KEY,
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    date_of_birth DATE NOT NULL,
    passport_number VARCHAR UNIQUE,
    nationality VARCHAR
);

CREATE TABLE BOOKING_PASSENGER (
    booking_id INT NOT NULL REFERENCES BOOKING(booking_id),
    passenger_id INT NOT NULL REFERENCES PASSENGER(passenger_id),
    special_requests TEXT, -- e.g., "Vegetarian meal", "Wheelchair access"
    
    PRIMARY KEY (booking_id, passenger_id)
);

CREATE TABLE PAYMENT (
    payment_id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL REFERENCES BOOKING(booking_id),
    amount DECIMAL NOT NULL,
    payment_date TIMESTAMP NOT NULL,
    payment_method VARCHAR NOT NULL, -- e.g., 'Credit Card', 'PayPal'
    transaction_id VARCHAR UNIQUE NOT NULL,
    payment_status VARCHAR NOT NULL -- e.g., 'Completed', 'Failed', 'Refunded'
);

-- ==========================================
-- 2. FLIGHT OPERATIONS
-- ==========================================

CREATE TABLE FLIGHT (
    flight_id SERIAL PRIMARY KEY,
    flight_number VARCHAR UNIQUE NOT NULL, -- e.g., "AA100"
    origin_airport_code CHAR(3) NOT NULL,    -- e.g., "JFK"
    destination_airport_code CHAR(3) NOT NULL, -- e.g., "LHR"
    base_duration_minutes INT NOT NULL
);

CREATE TABLE AIRCRAFT (
    aircraft_id SERIAL PRIMARY KEY,
    tail_number VARCHAR UNIQUE NOT NULL, -- e.g., "N12345"
    manufacturer VARCHAR NOT NULL,         -- e.g., "Boeing"
    model VARCHAR NOT NULL,                -- e.g., "777-300ER"
    total_capacity INT NOT NULL,
    manufacture_year INT
);

CREATE TABLE SEAT (
    seat_id SERIAL PRIMARY KEY,
    aircraft_id INT NOT NULL REFERENCES AIRCRAFT(aircraft_id),
    seat_number VARCHAR NOT NULL, -- e.g., "12A"
    seat_class VARCHAR NOT NULL,  -- e.g., "Economy", "First Class"
    
    CONSTRAINT uq_aircraft_seat UNIQUE (aircraft_id, seat_number),
    CONSTRAINT uq_seat_aircraft_composite UNIQUE (seat_id, aircraft_id) -- Required for composite FK in TICKET
);

CREATE TABLE SCHEDULE (
    schedule_id SERIAL PRIMARY KEY,
    flight_id INT NOT NULL REFERENCES FLIGHT(flight_id),
    aircraft_id INT NOT NULL REFERENCES AIRCRAFT(aircraft_id),
    departure_time TIMESTAMP NOT NULL,
    arrival_time TIMESTAMP NOT NULL,
    flight_status VARCHAR NOT NULL, -- e.g., 'Scheduled', 'Boarding', 'Departed', 'Delayed'
    
    CONSTRAINT uq_schedule_aircraft_composite UNIQUE (schedule_id, aircraft_id) -- Required for composite FK in TICKET
);

-- ==========================================
-- 3. TICKETING
-- ==========================================

CREATE TABLE TICKET (
    ticket_id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL REFERENCES BOOKING(booking_id),
    passenger_id INT NOT NULL REFERENCES PASSENGER(passenger_id),
    
    -- These three fields work together to enforce the diamond dependency natively
    schedule_id INT NOT NULL,
    seat_id INT NOT NULL,
    aircraft_id INT NOT NULL,

    ticket_number VARCHAR UNIQUE NOT NULL,
    fare_paid DECIMAL NOT NULL,
    boarding_group VARCHAR, -- e.g., "Group 1"
    
    CONSTRAINT uq_ticket_seat_schedule UNIQUE (seat_id, schedule_id),
    
    -- Composite Foreign Keys for strict schema-level enforcement
    CONSTRAINT fk_ticket_seat_aircraft FOREIGN KEY (seat_id, aircraft_id) REFERENCES SEAT(seat_id, aircraft_id),
    CONSTRAINT fk_ticket_schedule_aircraft FOREIGN KEY (schedule_id, aircraft_id) REFERENCES SCHEDULE(schedule_id, aircraft_id)
);

-- ==========================================
-- 4. EMPLOYEE MANAGEMENT & PROCESSING
-- ==========================================

CREATE TABLE EMPLOYEE (
    employee_id SERIAL PRIMARY KEY,
    first_name VARCHAR NOT NULL,
    last_name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    hire_date DATE NOT NULL
);

CREATE TABLE ROLE (
    role_id SERIAL PRIMARY KEY,
    role_name VARCHAR UNIQUE NOT NULL, -- e.g., "Admin", "Ticketing Agent"
    description TEXT
);

CREATE TABLE EMPLOYEE_ROLE (
    employee_id INT NOT NULL REFERENCES EMPLOYEE(employee_id),
    role_id INT NOT NULL REFERENCES ROLE(role_id),
    
    PRIMARY KEY (employee_id, role_id)
);

CREATE TABLE BOOKING_PROCESSING (
    employee_id INT NOT NULL REFERENCES EMPLOYEE(employee_id),
    booking_id INT NOT NULL REFERENCES BOOKING(booking_id),
    action_timestamp TIMESTAMP NOT NULL,
    action_type VARCHAR NOT NULL, -- e.g., "CREATED", "MODIFIED", "REFUNDED"
    notes TEXT, -- Optional context for the audit log
    
    PRIMARY KEY (employee_id, booking_id, action_timestamp)
);
