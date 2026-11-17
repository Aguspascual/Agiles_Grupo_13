-- Permite elegir una posición por partido sin modificar la preferencia del perfil.
ALTER TABLE pending_match_players
    ADD COLUMN position VARCHAR(20) CHECK (position IS NULL OR position IN ('Drive', 'Revés', 'Indistinto'));
