CREATE TABLE court_schedule_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_id UUID NOT NULL REFERENCES courts(id) ON DELETE RESTRICT,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
    enabled BOOLEAN NOT NULL,
    duration_minutes SMALLINT NOT NULL CHECK (duration_minutes IN (60, 90)),
    revision UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (court_id, weekday)
);

CREATE TABLE court_schedule_intervals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_day_id UUID NOT NULL REFERENCES court_schedule_days(id) ON DELETE CASCADE,
    opens_at TIME WITHOUT TIME ZONE NOT NULL,
    closes_at TIME WITHOUT TIME ZONE NOT NULL,
    CHECK (opens_at < closes_at),
    CHECK (opens_at >= TIME '00:00' AND closes_at < TIME '24:00'),
    CHECK (EXTRACT(SECOND FROM opens_at) = 0 AND EXTRACT(SECOND FROM closes_at) = 0),
    UNIQUE (schedule_day_id, opens_at)
);
