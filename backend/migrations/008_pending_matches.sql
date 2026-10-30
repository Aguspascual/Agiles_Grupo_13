ALTER TABLE reservations
    DROP CONSTRAINT reservations_contact_phone_check,
    DROP CONSTRAINT reservations_origin_check,
    DROP CONSTRAINT reservations_identity_check,
    ADD CONSTRAINT reservations_contact_phone_check CHECK (
        (origin = 'open_match' AND length(btrim(contact_phone)) = 0)
        OR length(btrim(contact_phone)) > 0
    ),
    ADD CONSTRAINT reservations_origin_check CHECK (origin IN ('web', 'manual', 'open_match')),
    ADD CONSTRAINT reservations_identity_check CHECK (
        (origin = 'web' AND organizer_id IS NOT NULL
            AND companions IS NOT NULL AND companions = 3
            AND registered_by = organizer_id)
        OR (origin = 'manual' AND organizer_id IS NULL AND companions IS NULL)
        OR (origin = 'open_match' AND organizer_id IS NOT NULL
            AND companions = 3 AND registered_by = organizer_id)
    );

CREATE TABLE pending_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
    target_level VARCHAR(20) NOT NULL CHECK (target_level IN (
        'Principiante', '8va', '7ma', '6ta', '5ta', '4ta', '3ra', '2da', '1ra'
    )),
    status TEXT NOT NULL CHECK (status IN ('open', 'full')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE pending_match_players (
    match_id UUID NOT NULL REFERENCES pending_matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_organizer BOOLEAN NOT NULL DEFAULT false,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (match_id, user_id)
);

CREATE UNIQUE INDEX pending_match_single_organizer_idx
    ON pending_match_players(match_id) WHERE is_organizer;
CREATE INDEX pending_matches_open_by_start_idx
    ON pending_matches(status, reservation_id);

CREATE TABLE pending_match_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES pending_matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind = 'match_completed'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at TIMESTAMPTZ,
    UNIQUE(match_id, user_id, kind)
);
