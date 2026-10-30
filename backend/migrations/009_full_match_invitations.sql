ALTER TABLE reservations
    DROP CONSTRAINT reservations_origin_check,
    DROP CONSTRAINT reservations_identity_check,
    ADD CONSTRAINT reservations_origin_check CHECK (origin IN ('web', 'manual', 'open_match', 'full_match')),
    ADD CONSTRAINT reservations_identity_check CHECK (
        (origin IN ('web', 'open_match', 'full_match') AND organizer_id IS NOT NULL
            AND companions IS NOT NULL AND companions = 3
            AND registered_by = organizer_id)
        OR (origin = 'manual' AND organizer_id IS NULL AND companions IS NULL)
    );

CREATE TABLE full_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL UNIQUE REFERENCES reservations(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'full', 'cancelled', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CHECK (expires_at > created_at)
);

CREATE TABLE full_match_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES full_matches(id) ON DELETE CASCADE,
    invited_name TEXT NOT NULL CHECK (length(btrim(invited_name)) BETWEEN 1 AND 120),
    invited_email TEXT,
    token_hash BYTEA NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'expired')),
    accepted_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    CHECK (invited_email IS NULL OR length(btrim(invited_email)) <= 254),
    CHECK ((status = 'accepted') = (accepted_user_id IS NOT NULL)),
    CHECK ((status = 'accepted') = (accepted_at IS NOT NULL))
);

CREATE UNIQUE INDEX full_match_invitation_email_idx
    ON full_match_invitations(match_id, lower(invited_email)) WHERE invited_email IS NOT NULL;
CREATE UNIQUE INDEX full_match_invitation_player_idx
    ON full_match_invitations(match_id, accepted_user_id) WHERE accepted_user_id IS NOT NULL;
CREATE INDEX full_matches_expiration_idx
    ON full_matches(expires_at) WHERE status = 'pending';
