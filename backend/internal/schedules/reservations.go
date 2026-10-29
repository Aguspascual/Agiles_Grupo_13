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

func (postgresReservationChecker) HasFutureReservations(ctx context.Context, tx pgx.Tx, courtID string, weekday int) (bool, error) {
	var exists bool
	err := tx.QueryRow(ctx, `SELECT EXISTS (
		SELECT 1 FROM reservations WHERE court_id=$1::uuid AND status='reserved'
		AND ends_at > statement_timestamp()
		AND EXTRACT(ISODOW FROM starts_at AT TIME ZONE 'America/Argentina/Buenos_Aires')=$2
	)`, courtID, weekday).Scan(&exists)
	return exists, err
}

func (postgresReservationChecker) HasReservationsOutside(ctx context.Context, tx pgx.Tx, courtID string, weekday int, intervals []Interval) (bool, error) {
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		return false, err
	}
	rows, err := tx.Query(ctx, `SELECT starts_at, ends_at FROM reservations
		WHERE court_id=$1::uuid AND status='reserved' AND ends_at > statement_timestamp()
		AND EXTRACT(ISODOW FROM starts_at AT TIME ZONE 'America/Argentina/Buenos_Aires')=$2`, courtID, weekday)
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
		covered := false
		for _, interval := range intervals {
			open, close := minutes(interval.OpensAt), minutes(interval.ClosesAt)
			if open < 0 || close < 0 {
				return false, ErrInvalid
			}
			from := time.Date(start.Year(), start.Month(), start.Day(), open/60, open%60, 0, 0, location)
			until := time.Date(start.Year(), start.Month(), start.Day(), close/60, close%60, 0, 0, location)
			if !start.Before(from) && !end.After(until) {
				covered = true
				break
			}
		}
		if !covered {
			return true, nil
		}
	}
	return false, rows.Err()
}
