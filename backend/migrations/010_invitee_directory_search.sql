ALTER TABLE full_match_invitations
    ADD COLUMN invited_user_id UUID REFERENCES users(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX full_match_invitation_invited_user_idx
    ON full_match_invitations(match_id, invited_user_id)
    WHERE invited_user_id IS NOT NULL;
