ALTER TABLE users
    ADD COLUMN role TEXT NOT NULL DEFAULT 'USER'
    CHECK (role IN ('USER', 'ADMIN'));

CREATE TABLE complexes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) NOT NULL CHECK (length(btrim(name)) > 0),
    address TEXT NOT NULL CHECK (length(btrim(address)) > 0),
    zone VARCHAR(40) NOT NULL CHECK (zone IN (
        'Casco Urbano', 'Gonnet', 'City Bell', 'San Carlos', 'Tolosa', 'Villa Elisa', 'Berisso / Ensenada'
    )),
    phone TEXT NOT NULL CHECK (length(btrim(phone)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX complexes_active_idx ON complexes (name) WHERE deleted_at IS NULL;

CREATE TABLE complex_managers (
    complex_id UUID NOT NULL REFERENCES complexes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (complex_id, user_id)
);

CREATE INDEX complex_managers_user_id_idx ON complex_managers (user_id, complex_id);
