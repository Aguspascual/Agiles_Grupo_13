CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complex_id UUID NOT NULL REFERENCES complexes(id),
    court_id UUID NOT NULL REFERENCES courts(id),
    organizer_id UUID NOT NULL REFERENCES users(id),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('reserved', 'cancelled')),
    companions SMALLINT NOT NULL CHECK (companions = 3),
    contact_name TEXT NOT NULL CHECK (length(btrim(contact_name)) > 0),
    contact_phone TEXT NOT NULL CHECK (length(btrim(contact_phone)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at)
);

CREATE INDEX reservations_active_court_interval_idx
    ON reservations (court_id, starts_at, ends_at) WHERE status = 'reserved';

CREATE TABLE reservation_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    reservation_id UUID NOT NULL REFERENCES reservations(id),
    kind TEXT NOT NULL CHECK (kind = 'reservation_confirmed'),
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (reservation_id, kind)
);
