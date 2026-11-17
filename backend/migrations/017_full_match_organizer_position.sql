-- Guarda la posición elegida por el organizador también en los partidos completos.
ALTER TABLE full_matches
    ADD COLUMN organizer_position VARCHAR(20) NOT NULL DEFAULT 'Indistinto'
        CHECK (organizer_position IN ('Drive', 'Revés', 'Indistinto'));
