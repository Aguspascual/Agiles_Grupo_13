-- Un partido abierto puede buscar hasta tres niveles: target_level es el primero y extra_levels el resto.
ALTER TABLE pending_matches ADD COLUMN extra_levels VARCHAR(20)[] NOT NULL DEFAULT '{}';

ALTER TABLE pending_matches ADD CONSTRAINT pending_matches_extra_levels_check CHECK (
    cardinality(extra_levels) <= 2
    AND extra_levels <@ ARRAY['Principiante', '8va', '7ma', '6ta', '5ta', '4ta', '3ra', '2da', '1ra']::VARCHAR(20)[]
);

-- Lugar elegido en la cancha (1 y 2: pareja A, 3 y 4: pareja B).
ALTER TABLE pending_match_players ADD COLUMN slot SMALLINT CHECK (slot IS NULL OR slot BETWEEN 1 AND 4);

CREATE UNIQUE INDEX pending_match_players_slot_idx ON pending_match_players (match_id, slot) WHERE slot IS NOT NULL;