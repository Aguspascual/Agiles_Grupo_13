package schedules

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// FutureReservationChecker must inspect real records inside the supplied transaction,
// using America/Argentina/Buenos_Aires to match recurring weekdays and the server clock.
// Reservation writers must lock the same court row before confirming any interval.
// The checker must preserve existing bookings' actual start/end/duration.
type FutureReservationChecker interface {
	HasFutureReservations(context.Context, pgx.Tx, string, int) (bool, error)
	HasReservationsOutside(context.Context, pgx.Tx, string, int, []Interval) (bool, error)
}

type unavailableReservationChecker struct{}

func (unavailableReservationChecker) HasFutureReservations(context.Context, pgx.Tx, string, int) (bool, error) {
	return false, ErrReservationSourceUnavailable
}
func (unavailableReservationChecker) HasReservationsOutside(context.Context, pgx.Tx, string, int, []Interval) (bool, error) {
	return false, ErrReservationSourceUnavailable
}

type postgresReservationChecker struct{}

const reservationDay = "EXTRACT(ISODOW FROM starts_at AT TIME ZONE 'America/Argentina/Buenos_Aires')"

// HasFutureReservations also counts the reservations that start on the following day while the
// weekday's overnight interval is still open, because deleting the day would leave them uncovered.
func (postgresReservationChecker) HasFutureReservations(ctx context.Context, tx pgx.Tx, courtID string, weekday int) (bool, error) {
	var spillEnd int
	if err := tx.QueryRow(ctx, `SELECT COALESCE(MAX(EXTRACT(HOUR FROM i.closes_at)*60+EXTRACT(MINUTE FROM i.closes_at)),0)::int
		FROM court_schedule_intervals i JOIN court_schedule_days d ON d.id=i.schedule_day_id
		WHERE d.court_id=$1::uuid AND d.weekday=$2 AND i.closes_at < i.opens_at`, courtID, weekday).Scan(&spillEnd); err != nil {
		return false, err
	}
	var exists bool
	err := tx.QueryRow(ctx, `SELECT EXISTS (
		SELECT 1 FROM reservations WHERE court_id=$1::uuid AND status='reserved'
		AND ends_at > statement_timestamp()
		AND (`+reservationDay+`=$2 OR (`+reservationDay+`=$2 % 7 + 1
			AND EXTRACT(HOUR FROM starts_at AT TIME ZONE 'America/Argentina/Buenos_Aires')*60
			  + EXTRACT(MINUTE FROM starts_at AT TIME ZONE 'America/Argentina/Buenos_Aires') < $3))
	)`, courtID, weekday, spillEnd).Scan(&exists)
	return exists, err
}

// HasReservationsOutside checks every future reservation that the edited weekday governs: the ones
// starting that day and the ones starting the next day inside its overnight spill. A reservation is
// covered by an interval of its own day or by an overnight interval of the previous day.
func (postgresReservationChecker) HasReservationsOutside(ctx context.Context, tx pgx.Tx, courtID string, weekday int, intervals []Interval) (bool, error) {
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		return false, err
	}
	byWeekday, err := storedIntervals(ctx, tx, courtID)
	if err != nil {
		return false, err
	}
	byWeekday[weekday] = intervals
	rows, err := tx.Query(ctx, `SELECT starts_at, ends_at FROM reservations
		WHERE court_id=$1::uuid AND status='reserved' AND ends_at > statement_timestamp()
		AND `+reservationDay+` IN ($2, $2 % 7 + 1)`, courtID, weekday)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	for rows.Next() {
		var start, end time.Time
		if err := rows.Scan(&start, &end); err != nil {
			return false, err
		}
		start = start.In(location)
		covered, err := coveredByIntervals(byWeekday, start, end, location)
		if err != nil {
			return false, err
		}
		if !covered {
			return true, nil
		}
	}
	return false, rows.Err()
}

func coveredByIntervals(byWeekday map[int][]Interval, start, end time.Time, location *time.Location) (bool, error) {
	weekday := int(start.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	candidates := []struct {
		day       time.Time
		intervals []Interval
	}{
		{start, byWeekday[weekday]},
		{start.AddDate(0, 0, -1), byWeekday[(weekday+5)%7+1]},
	}
	for _, candidate := range candidates {
		for _, interval := range candidate.intervals {
			open, close, ok := interval.Range()
			if !ok {
				return false, ErrInvalid
			}
			day := candidate.day
			from := time.Date(day.Year(), day.Month(), day.Day(), open/60, open%60, 0, 0, location)
			until := time.Date(day.Year(), day.Month(), day.Day(), close/60, close%60, 0, 0, location)
			if !start.Before(from) && !end.After(until) {
				return true, nil
			}
		}
	}
	return false, nil
}

func storedIntervals(ctx context.Context, tx pgx.Tx, courtID string) (map[int][]Interval, error) {
	rows, err := tx.Query(ctx, `SELECT d.weekday, to_char(i.opens_at,'HH24:MI'), to_char(i.closes_at,'HH24:MI')
		FROM court_schedule_days d JOIN court_schedule_intervals i ON i.schedule_day_id=d.id
		WHERE d.court_id=$1::uuid`, courtID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[int][]Interval{}
	for rows.Next() {
		var weekday int
		var interval Interval
		if err := rows.Scan(&weekday, &interval.OpensAt, &interval.ClosesAt); err != nil {
			return nil, err
		}
		result[weekday] = append(result[weekday], interval)
	}
	return result, rows.Err()
}
