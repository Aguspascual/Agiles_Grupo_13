ALTER TABLE pending_match_notices
    DROP CONSTRAINT IF EXISTS pending_match_notices_kind_check,
    ADD CONSTRAINT pending_match_notices_kind_check
        CHECK (kind IN ('match_completed', 'player_left'));

ALTER TABLE pending_match_notices
    DROP CONSTRAINT IF EXISTS pending_match_notices_match_id_user_id_kind_key;

CREATE INDEX pending_match_notices_match_user_kind_idx
    ON pending_match_notices(match_id, user_id, kind);
