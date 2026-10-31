-- Una franja puede cruzar la medianoche: si closes_at es menor que opens_at, cierra al día siguiente.
ALTER TABLE court_schedule_intervals DROP CONSTRAINT court_schedule_intervals_check;

ALTER TABLE court_schedule_intervals
    ADD CONSTRAINT court_schedule_intervals_not_empty CHECK (opens_at <> closes_at);
