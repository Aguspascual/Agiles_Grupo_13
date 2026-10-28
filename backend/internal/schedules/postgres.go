package schedules

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct {
	db *pgxpool.Pool
}

func NewPostgresRepository(db *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) List(ctx context.Context, complexID, courtID, actorID string, admin bool) ([]Day, error) {
	tx, err := r.authorizedTransaction(ctx, complexID, courtID, actorID, admin, false)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	days, err := readDays(ctx, tx, courtID, 0)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return days, nil
}

func (r *PostgresRepository) Get(ctx context.Context, complexID, courtID, actorID string, admin bool, weekday int) (Day, error) {
	if weekday < 1 || weekday > 7 {
		return Day{}, ErrInvalid
	}
	tx, err := r.authorizedTransaction(ctx, complexID, courtID, actorID, admin, false)
	if err != nil {
		return Day{}, err
	}
	defer tx.Rollback(ctx)
	day, err := readDay(ctx, tx, courtID, weekday)
	if err != nil {
		return Day{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Day{}, err
	}
	return day, nil
}

func (r *PostgresRepository) Create(ctx context.Context, complexID, courtID, actorID string, admin bool, draft Draft) (Day, error) {
	if err := draft.Validate(); err != nil {
		return Day{}, err
	}
	tx, err := r.authorizedTransaction(ctx, complexID, courtID, actorID, admin, true)
	if err != nil {
		return Day{}, err
	}
	defer tx.Rollback(ctx)
	var dayID string
	err = tx.QueryRow(ctx, `INSERT INTO court_schedule_days(court_id,weekday,enabled,duration_minutes)
		VALUES($1::uuid,$2,$3,$4) ON CONFLICT(court_id,weekday) DO NOTHING RETURNING id::text`,
		courtID, draft.Weekday, draft.Enabled, draft.DurationMinutes).Scan(&dayID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Day{}, ErrConflict
	}
	if err != nil {
		return Day{}, err
	}
	if err := insertIntervals(ctx, tx, dayID, draft.Intervals); err != nil {
		return Day{}, err
	}
	return commitDay(ctx, tx, courtID, draft.Weekday)
}
