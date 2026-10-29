package schedules

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct {
	db           *pgxpool.Pool
	reservations FutureReservationChecker
}

func NewPostgresRepository(db *pgxpool.Pool) *PostgresRepository {
	return NewPostgresRepositoryWithReservationChecker(db, postgresReservationChecker{})
}

func NewPostgresRepositoryWithReservationChecker(db *pgxpool.Pool, checker FutureReservationChecker) *PostgresRepository {
	if checker == nil {
		checker = unavailableReservationChecker{}
	}
	return &PostgresRepository{db: db, reservations: checker}
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

func (r *PostgresRepository) Update(ctx context.Context, complexID, courtID, actorID string, admin bool, revision string, draft Draft) (Day, error) {
	if err := draft.Validate(); err != nil {
		return Day{}, err
	}
	tx, err := r.authorizedTransaction(ctx, complexID, courtID, actorID, admin, true)
	if err != nil {
		return Day{}, err
	}
	defer tx.Rollback(ctx)
	current, err := readDay(ctx, tx, courtID, draft.Weekday)
	if err != nil {
		return Day{}, err
	}
	if current.Revision != revision {
		return Day{}, ErrStaleRevision
	}
	changed := !sameIntervals(current.Intervals, draft.Intervals)
	if changed {
		affected, err := r.reservations.HasReservationsOutside(ctx, tx, courtID, draft.Weekday, draft.Intervals)
		if err != nil {
			return Day{}, err
		}
		if affected {
			return Day{}, ErrFutureReservations
		}
	}
	var dayID string
	err = tx.QueryRow(ctx, `UPDATE court_schedule_days SET enabled=$4,duration_minutes=$5,
		revision=gen_random_uuid(),updated_at=now()
		WHERE court_id=$1::uuid AND weekday=$2 AND revision=$3::uuid RETURNING id::text`,
		courtID, draft.Weekday, revision, draft.Enabled, draft.DurationMinutes).Scan(&dayID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Day{}, ErrStaleRevision
	}
	if err != nil {
		return Day{}, err
	}
	if changed {
		if _, err := tx.Exec(ctx, "DELETE FROM court_schedule_intervals WHERE schedule_day_id=$1::uuid", dayID); err != nil {
			return Day{}, err
		}
		if err := insertIntervals(ctx, tx, dayID, draft.Intervals); err != nil {
			return Day{}, err
		}
	}
	return commitDay(ctx, tx, courtID, draft.Weekday)
}

func (r *PostgresRepository) Delete(ctx context.Context, complexID, courtID, actorID string, admin bool, weekday int, revision string) error {
	if weekday < 1 || weekday > 7 {
		return ErrInvalid
	}
	tx, err := r.authorizedTransaction(ctx, complexID, courtID, actorID, admin, true)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	current, err := readDay(ctx, tx, courtID, weekday)
	if err != nil {
		return err
	}
	if current.Revision != revision {
		return ErrStaleRevision
	}
	hasFuture, err := r.reservations.HasFutureReservations(ctx, tx, courtID, weekday)
	if err != nil {
		return err
	}
	if hasFuture {
		return ErrFutureReservations
	}
	result, err := tx.Exec(ctx, "DELETE FROM court_schedule_days WHERE court_id=$1::uuid AND weekday=$2 AND revision=$3::uuid", courtID, weekday, revision)
	if err != nil {
		return err
	}
	if result.RowsAffected() != 1 {
		return ErrStaleRevision
	}
	return tx.Commit(ctx)
}

func sameIntervals(left, right []Interval) bool {
	if len(left) != len(right) {
		return false
	}
	for i := range left {
		if left[i].OpensAt != right[i].OpensAt || left[i].ClosesAt != right[i].ClosesAt {
			return false
		}
	}
	return true
}
