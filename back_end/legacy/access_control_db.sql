-- ==============================================================================
-- FILE: 03_access_control_t2.sql
-- DESCRIPTION: Access Control & Data Protection (Member 3)
-- Run AFTER:
--   01_schema_t0.sql
--   02_constraints_t1.sql
-- ==============================================================================


-- ========================
-- 1. ROLE CREATION
-- ========================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin') THEN
        CREATE ROLE admin;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'staff') THEN
        CREATE ROLE staff;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'customer') THEN
        CREATE ROLE customer;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'agency') THEN
        CREATE ROLE agency;
    END IF;
END
$$;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;

-- Booking operations
GRANT SELECT, INSERT, UPDATE ON BOOKING TO staff;
GRANT SELECT, INSERT, UPDATE ON PASSENGER TO staff;
GRANT SELECT, INSERT ON BOOKING_PASSENGER TO staff;

-- Ticketing
GRANT SELECT, INSERT ON TICKET TO staff;

-- Payments
GRANT SELECT, INSERT ON PAYMENT TO staff;

-- Flight viewing
GRANT SELECT ON FLIGHT TO staff;
GRANT SELECT ON SCHEDULE TO staff;
GRANT SELECT ON SEAT TO staff;
GRANT SELECT ON AIRCRAFT TO staff;

-- User lookup
GRANT SELECT ON "USER" TO staff;
GRANT SELECT ON TRAVEL_AGENCY TO staff;

-- Processing log
GRANT INSERT ON BOOKING_PROCESSING TO staff;

-- Booking
GRANT SELECT, INSERT ON BOOKING TO customer;
GRANT INSERT ON PASSENGER TO customer;
GRANT INSERT ON BOOKING_PASSENGER TO customer;

-- Ticket viewing
GRANT SELECT ON TICKET TO customer;

-- Flight viewing
GRANT SELECT ON FLIGHT TO customer;
GRANT SELECT ON SCHEDULE TO customer;
GRANT SELECT ON SEAT TO customer;

-- restricted user info
GRANT SELECT (user_id, first_name, last_name, email)
ON "USER" TO customer;

GRANT SELECT, INSERT ON BOOKING TO agency;
GRANT INSERT ON PASSENGER TO agency;
GRANT INSERT ON BOOKING_PASSENGER TO agency;
GRANT INSERT ON PAYMENT TO agency;

GRANT SELECT ON FLIGHT TO agency;
GRANT SELECT ON SCHEDULE TO agency;
GRANT SELECT ON SEAT TO agency;

REVOKE ALL ON PAYMENT FROM customer;
REVOKE ALL ON EMPLOYEE FROM customer;
REVOKE ALL ON ROLE FROM customer;
REVOKE ALL ON EMPLOYEE_ROLE FROM customer;

REVOKE DELETE ON FLIGHT FROM staff;
REVOKE DELETE ON AIRCRAFT FROM staff;
REVOKE DELETE ON SCHEDULE FROM staff;

-- Hide passport numbers
CREATE OR REPLACE VIEW passenger_public AS
SELECT
    passenger_id,
    first_name,
    last_name,
    nationality
FROM PASSENGER;

GRANT SELECT ON passenger_public TO customer;
GRANT SELECT ON passenger_public TO agency;



-- Hide payment details
CREATE OR REPLACE VIEW payment_public AS
SELECT
    payment_id,
    booking_id,
    payment_status,
    payment_date
FROM PAYMENT;

GRANT SELECT ON payment_public TO customer;



-- Limited user view
CREATE OR REPLACE VIEW user_public AS
SELECT
    user_id,
    first_name,
    last_name,
    email
FROM "USER";

GRANT SELECT ON user_public TO staff;
GRANT SELECT ON user_public TO customer;

ALTER TABLE BOOKING ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_booking_policy
ON BOOKING
FOR SELECT
TO customer
USING (user_id = current_setting('app.current_user_id')::INT);

CREATE OR REPLACE FUNCTION log_booking_update()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO BOOKING_PROCESSING
    VALUES (
        current_setting('app.current_employee_id')::INT,
        NEW.booking_id,
        CURRENT_TIMESTAMP,
        'MODIFIED',
        'Booking updated via staff role'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_update_log ON BOOKING;

CREATE TRIGGER trg_booking_update_log
AFTER UPDATE ON BOOKING
FOR EACH ROW
EXECUTE FUNCTION log_booking_update();

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT ON TABLES TO customer;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE ON TABLES TO staff;
