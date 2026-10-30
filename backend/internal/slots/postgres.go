package slots

import (
	"context"
	"errors"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/schedules"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct{ db *pgxpool.Pool }

func NewPostgresRepository(db *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{db: db}
}

// ListComplexes returns active complexes with the same public fields as Complex.
func (r *PostgresRepository) ListComplexes(ctx context.Context) ([]Complex, error) {
	rows, err := r.db.Query(ctx, `SELECT id::text,name,address,zone FROM complexes WHERE deleted_at IS NULL ORDER BY name,id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	complexes := []Complex{}
	for rows.Next() {
		var item Complex
		if err := rows.Scan(&item.ID, &item.Name, &item.Address, &item.Zone); err != nil {
			return nil, err
		}
		complexes = append(complexes, item)
	}
	return complexes, rows.Err()
}

func (r *PostgresRepository) ReadAvailability(ctx context.Context, complexID string, dayStart, dayEnd time.Time, weekday int) (Snapshot, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return Snapshot{}, err
	}
	defer tx.Rollback(context.Background())
	var snapshot Snapshot
	err = tx.QueryRow(ctx, `SELECT id::text,name,address,zone FROM complexes WHERE id=$1::uuid AND deleted_at IS NULL`, complexID).
		Scan(&snapshot.Complex.ID, &snapshot.Complex.Name, &snapshot.Complex.Address, &snapshot.Complex.Zone)
	if errors.Is(err, pgx.ErrNoRows) {
		return Snapshot{}, ErrNotFound
	}
	if err != nil {
		return Snapshot{}, err
	}
	snapshot.Courts, err = ReadCourtData(ctx, tx, complexID, weekday)
	if err != nil {
		return Snapshot{}, err
	}
	reservationRows, err := tx.Query(ctx, `SELECT r.court_id::text,r.starts_at,r.ends_at,
		CASE WHEN r.origin='open_match' AND pm.id IS NOT NULL THEN pm.target_level END,
		CASE WHEN r.origin='open_match' AND pm.id IS NOT NULL
			THEN 4-(SELECT count(*) FROM pending_match_players p WHERE p.match_id=pm.id) END
		FROM reservations r JOIN courts c ON c.id=r.court_id
		LEFT JOIN pending_matches pm ON pm.reservation_id=r.id AND pm.status='open'
		WHERE c.complex_id=$1::uuid AND c.deleted_at IS NULL AND r.status='reserved'
		AND r.starts_at < $3 AND r.ends_at > $2 ORDER BY r.starts_at,r.ends_at,r.court_id`, complexID, dayStart, dayEnd)
	if err != nil {
		return Snapshot{}, err
	}
	for reservationRows.Next() {
		var reservation ReservationData
		var level *string
		var missing *int
		if err := reservationRows.Scan(&reservation.CourtID, &reservation.StartsAt, &reservation.EndsAt, &level, &missing); err != nil {
			reservationRows.Close()
			return Snapshot{}, err
		}
		if level != nil && missing != nil && *missing >= 1 && *missing <= 3 {
			reservation.OpenMatch = &OpenMatchInfo{Level: *level, Missing: *missing}
		}
		reservation.StartsAt = reservation.StartsAt.In(dayStart.Location())
		reservation.EndsAt = reservation.EndsAt.In(dayStart.Location())
		snapshot.Reservations = append(snapshot.Reservations, reservation)
	}
	if err := reservationRows.Err(); err != nil {
		reservationRows.Close()
		return Snapshot{}, err
	}
	reservationRows.Close()
	if err := tx.Commit(ctx); err != nil {
		return Snapshot{}, err
	}
	if snapshot.Courts == nil {
		snapshot.Courts = []CourtData{}
	}
	if snapshot.Reservations == nil {
		snapshot.Reservations = []ReservationData{}
	}
	return snapshot, nil
}

// ReadCourtData reads active courts with the schedule of one weekday inside an open transaction.
func ReadCourtData(ctx context.Context, tx pgx.Tx, complexID string, weekday int) ([]CourtData, error) {
	rows, err := tx.Query(ctx, `SELECT c.id::text,c.name,c.covered,d.id::text,d.weekday,d.enabled,d.duration_minutes,
		d.revision::text,i.id::text,to_char(i.opens_at,'HH24:MI'),to_char(i.closes_at,'HH24:MI')
		FROM courts c LEFT JOIN court_schedule_days d ON d.court_id=c.id AND d.weekday IN ($2::int, ($2::int+5)%7+1)
		LEFT JOIN court_schedule_intervals i ON i.schedule_day_id=d.id
		WHERE c.complex_id=$1::uuid AND c.deleted_at IS NULL
		ORDER BY c.name,c.id,i.opens_at,i.id`, complexID, weekday)
	if err != nil {
		return nil, err
	}
	var courts []CourtData
	byID := make(map[string]int)
	for rows.Next() {
		var courtID, name string
		var covered bool
		var scheduleID, revision, intervalID, opensAt, closesAt *string
		var scheduleWeekday, duration *int16
		var enabled *bool
		if err := rows.Scan(&courtID, &name, &covered, &scheduleID, &scheduleWeekday, &enabled, &duration,
			&revision, &intervalID, &opensAt, &closesAt); err != nil {
			rows.Close()
			return nil, err
		}
		index, exists := byID[courtID]
		if !exists {
			index = len(courts)
			byID[courtID] = index
			courts = append(courts, CourtData{ID: courtID, Name: name, Covered: covered})
		}
		if scheduleID != nil {
			court := &courts[index]
			target := &court.Previous
			if int(*scheduleWeekday) == weekday {
				target = &court.Schedule
			}
			if *target == nil {
				*target = &schedules.Day{Weekday: int(*scheduleWeekday), Enabled: *enabled, DurationMinutes: int(*duration), Revision: *revision, Intervals: []schedules.Interval{}}
			}
			if intervalID != nil {
				(*target).Intervals = append((*target).Intervals, schedules.Interval{ID: *intervalID, OpensAt: *opensAt, ClosesAt: *closesAt})
			}
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()
	return courts, nil
}
