ALTER TABLE reservations
    ADD COLUMN origin TEXT NOT NULL DEFAULT 'web',
    ADD COLUMN registered_by UUID REFERENCES users(id);

UPDATE reservations SET registered_by = organizer_id;

ALTER TABLE reservations
    ALTER COLUMN registered_by SET NOT NULL,
    ALTER COLUMN organizer_id DROP NOT NULL,
    ALTER COLUMN companions DROP NOT NULL,
    DROP CONSTRAINT reservations_companions_check,
    ADD CONSTRAINT reservations_origin_check CHECK (origin IN ('web', 'manual')),
    ADD CONSTRAINT reservations_identity_check CHECK (
        (origin = 'web' AND organizer_id IS NOT NULL
            AND companions IS NOT NULL AND companions = 3
            AND registered_by = organizer_id)
        OR (origin = 'manual' AND organizer_id IS NULL AND companions IS NULL)
    );
