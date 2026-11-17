-- HU-09: conserva el nombre y el lugar en cancha de los invitados sin cuenta.
CREATE TABLE pending_match_guests (
    match_id UUID NOT NULL REFERENCES pending_matches(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL CHECK (length(btrim(name)) > 0),
    slot SMALLINT NOT NULL CHECK (slot BETWEEN 1 AND 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (match_id, slot)
);

CREATE INDEX pending_match_guests_match_idx ON pending_match_guests(match_id);
