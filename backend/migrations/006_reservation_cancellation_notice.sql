ALTER TABLE reservation_notices
    DROP CONSTRAINT reservation_notices_kind_check;

ALTER TABLE reservation_notices
    ADD CONSTRAINT reservation_notices_kind_check
    CHECK (kind IN ('reservation_confirmed', 'reservation_cancelled'));
