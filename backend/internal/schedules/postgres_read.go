package schedules

import (
	"context"

	"github.com/jackc/pgx/v5"
)

func readDays(ctx context.Context, tx pgx.Tx, courtID string, weekday int) ([]Day, error) {
	rows, err := tx.Query(ctx, `SELECT d.weekday,d.enabled,d.duration_minutes,d.revision::text,
		i.id::text,to_char(i.opens_at,'HH24:MI'),to_char(i.closes_at,'HH24:MI')
		FROM court_schedule_days d LEFT JOIN court_schedule_intervals i ON i.schedule_day_id=d.id
		WHERE d.court_id=$1::uuid AND ($2::int=0 OR d.weekday=$2::int)
		ORDER BY d.weekday,i.opens_at,i.id`, courtID, weekday)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	days := make([]Day, 0)
	for rows.Next() {
		var day Day
		var id, opens, closes *string
		if err := rows.Scan(&day.Weekday, &day.Enabled, &day.DurationMinutes, &day.Revision, &id, &opens, &closes); err != nil {
			return nil, err
		}
		if len(days) == 0 || days[len(days)-1].Weekday != day.Weekday {
			day.Intervals = []Interval{}
			days = append(days, day)
		}
		if id != nil {
			days[len(days)-1].Intervals = append(days[len(days)-1].Intervals, Interval{ID: *id, OpensAt: *opens, ClosesAt: *closes})
		}
	}
	return days, rows.Err()
}

func readDay(ctx context.Context, tx pgx.Tx, courtID string, weekday int) (Day, error) {
	days, err := readDays(ctx, tx, courtID, weekday)
	if err != nil {
		return Day{}, err
	}
	if len(days) == 0 {
		return Day{}, ErrNotFound
	}
	return days[0], nil
}

func insertIntervals(ctx context.Context, tx pgx.Tx, dayID string, intervals []Interval) error {
	for _, interval := range intervals {
		if _, err := tx.Exec(ctx, "INSERT INTO court_schedule_intervals(schedule_day_id,opens_at,closes_at) VALUES($1::uuid,$2::time,$3::time)", dayID, interval.OpensAt, interval.ClosesAt); err != nil {
			return err
		}
	}
	return nil
}

func commitDay(ctx context.Context, tx pgx.Tx, courtID string, weekday int) (Day, error) {
	day, err := readDay(ctx, tx, courtID, weekday)
	if err != nil {
		return Day{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Day{}, err
	}
	return day, nil
}
