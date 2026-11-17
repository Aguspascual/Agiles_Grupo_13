CREATE TABLE match_absence_reports (
    match_id UUID NOT NULL,
    reported_user_id UUID NOT NULL,
    reporter_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (match_id, reported_user_id, reporter_user_id),
    CHECK (reported_user_id <> reporter_user_id),
    FOREIGN KEY (match_id, reported_user_id)
        REFERENCES pending_match_players(match_id, user_id) ON DELETE RESTRICT,
    FOREIGN KEY (match_id, reporter_user_id)
        REFERENCES pending_match_players(match_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX match_absence_reports_by_target_idx
    ON match_absence_reports(match_id, reported_user_id);
