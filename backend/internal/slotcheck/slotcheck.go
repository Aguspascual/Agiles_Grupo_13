// Package slotcheck validates, inside a transaction, that a slot is offered by a court's weekly
// schedule. It does not depend on the schedules or reservations packages so both can use it.
package slotcheck

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

const minutesPerDay = 24 * 60

// Duration returns the duration of the slot that begins at start when the court schedule offers it:
// either on the weekday of start, or as the overnight spill of the previous weekday (an interval whose
// closing time is earlier than its opening time ends on the following day).
func Duration(ctx context.Context, tx pgx.Tx, courtID string, start time.Time) (int, bool, error) {
	weekday := int(start.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	minute := start.Hour()*60 + start.Minute()
	rows, err := tx.Query(ctx, `SELECT d.weekday, d.duration_minutes,
			(EXTRACT(HOUR FROM i.opens_at)*60+EXTRACT(MINUTE FROM i.opens_at))::int,
			(EXTRACT(HOUR FROM i.closes_at)*60+EXTRACT(MINUTE FROM i.closes_at))::int
		FROM court_schedule_days d JOIN court_schedule_intervals i ON i.schedule_day_id=d.id
		WHERE d.court_id=$1::uuid AND d.enabled AND d.weekday IN ($2::int, ($2::int+5)%7+1)`, courtID, weekday)
	if err != nil {
		return 0, false, err
	}
	defer rows.Close()
	for rows.Next() {
		var dayWeekday, duration, open, closing int
		if err := rows.Scan(&dayWeekday, &duration, &open, &closing); err != nil {
			return 0, false, err
		}
		if closing < open {
			closing += minutesPerDay
		}
		offset := minute
		if dayWeekday != weekday {
			offset += minutesPerDay
		}
		if closing != open && offset >= open && offset+duration <= closing && (offset-open)%duration == 0 {
			return duration, true, nil
		}
	}
	return 0, false, rows.Err()
}