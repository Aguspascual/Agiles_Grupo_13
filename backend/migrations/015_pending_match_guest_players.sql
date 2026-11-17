-- HU-09 Parte 2: companions on an open match occupy seats without user accounts.
-- Previous open matches used companions=3 as a fixed reservation default, not actual guests.
ALTER TABLE reservations
    DROP CONSTRAINT reservations_identity_check;

UPDATE reservations
SET companions = 0
WHERE origin = 'open_match';

ALTER TABLE reservations
    ADD CONSTRAINT reservations_identity_check CHECK (
        (origin IN ('web', 'full_match') AND organizer_id IS NOT NULL
            AND companions IS NOT NULL AND companions = 3 AND registered_by = organizer_id)
        OR (origin = 'manual' AND organizer_id IS NULL AND companions IS NULL)
        OR (origin = 'open_match' AND organizer_id IS NOT NULL
            AND companions IS NOT NULL AND companions BETWEEN 0 AND 3 AND registered_by = organizer_id)
    );
