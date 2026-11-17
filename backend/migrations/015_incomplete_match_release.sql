ALTER TABLE pending_matches
    DROP CONSTRAINT pending_matches_status_check,
    ADD CONSTRAINT pending_matches_status_check
        CHECK (status IN ('open', 'full', 'cancelled'));

ALTER TABLE pending_match_notices
    DROP CONSTRAINT pending_match_notices_kind_check,
    ADD CONSTRAINT pending_match_notices_kind_check
        CHECK (kind IN ('match_completed', 'player_left', 'match_cancelled'));
