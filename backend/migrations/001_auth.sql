CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    zone VARCHAR(40) NOT NULL CHECK (zone IN (
        'Casco Urbano', 'Gonnet', 'City Bell', 'San Carlos', 'Tolosa', 'Villa Elisa', 'Berisso / Ensenada'
    )),
    level VARCHAR(20) NOT NULL CHECK (level IN (
        'Principiante', '8va', '7ma', '6ta', '5ta', '4ta', '3ra', '2da', '1ra'
    )),
    position VARCHAR(20) CHECK (position IS NULL OR position IN ('Drive', 'Revés', 'Indistinto')),
    hand VARCHAR(20) CHECK (hand IS NULL OR hand IN ('Diestro', 'Zurdo')),
    fair_play_accepted_at TIMESTAMPTZ NOT NULL
);
