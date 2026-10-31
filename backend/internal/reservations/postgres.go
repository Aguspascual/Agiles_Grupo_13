package reservations

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/slotcheck"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NamedResource struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Reservation struct {
	ID       string        `json:"id"`
	Status   string        `json:"status"`
	Complex  NamedResource `json:"complex"`
	Court    NamedResource `json:"court"`
	Date     string        `json:"date"`
	StartsAt string        `json:"startsAt"`
	EndsAt   string        `json:"endsAt"`
	TimeZone string        `json:"timeZone"`
}

type Repository struct {
	db  *pgxpool.Pool
	now func() time.Time
}

func NewRepository(db *pgxpool.Pool) *Repository { return NewRepositoryWithClock(db, time.Now) }

// NewRepositoryWithClock injects the server clock used by cancellation rules.
func NewRepositoryWithClock(db *pgxpool.Pool, clock func() time.Time) *Repository {
	return &Repository{db: db, now: clock}
}

func (r *Repository) ListOwn(ctx context.Context, actorID string, start, end time.Time, location *time.Location) ([]Reservation, error) {
	rows, err := r.db.Query(ctx, `SELECT r.id::text, r.status, c.id::text, c.name, court.id::text, court.name, r.starts_at, r.ends_at
		FROM reservations r JOIN complexes c ON c.id=r.complex_id JOIN courts court ON court.id=r.court_id
		WHERE r.organizer_id=$1::uuid AND r.status='reserved' AND r.starts_at >= $2 AND r.starts_at < $3
		ORDER BY r.starts_at, r.id`, actorID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Reservation, 0)
	for rows.Next() {
		var item Reservation
		var startsAt, endsAt time.Time
		if err := rows.Scan(&item.ID, &item.Status, &item.Complex.ID, &item.Complex.Name, &item.Court.ID, &item.Court.Name, &startsAt, &endsAt); err != nil {
			return nil, err
		}
		item.Date = startsAt.In(location).Format("2006-01-02")
		item.StartsAt = startsAt.In(location).Format("15:04")
		item.EndsAt = endsAt.In(location).Format("15:04")
		item.TimeZone = "America/Argentina/Buenos_Aires"
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) Create(ctx context.Context, complexID, courtID, actorID string, input Request, start time.Time) (Reservation, error) {
	return r.create(ctx, complexID, courtID, actorID, input, start, false)
}

func (r *Repository) CreateManual(ctx context.Context, complexID, courtID, actorID string, input Request, start time.Time) (Reservation, error) {
	return r.create(ctx, complexID, courtID, actorID, input, start, true)
}

func (r *Repository) create(ctx context.Context, complexID, courtID, actorID string, input Request, start time.Time, manual bool) (Reservation, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Reservation{}, err
	}
	defer tx.Rollback(ctx)
	result := Reservation{Status: "reserved", Complex: NamedResource{ID: complexID}, Court: NamedResource{ID: courtID}, Date: input.Date, StartsAt: input.StartsAt, TimeZone: "America/Argentina/Buenos_Aires"}
	err = tx.QueryRow(ctx, `SELECT name FROM complexes WHERE id=$1::uuid AND deleted_at IS NULL FOR SHARE`, complexID).Scan(&result.Complex.Name)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return Reservation{}, err
	}
	if manual {
		if authErr := authorizeManual(ctx, tx, complexID, actorID, errors.Is(err, pgx.ErrNoRows)); authErr != nil {
			return Reservation{}, authErr
		}
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return Reservation{}, ErrNotFound
	}
	if err != nil {
		return Reservation{}, err
	}
	err = tx.QueryRow(ctx, `SELECT name FROM courts WHERE id=$1::uuid AND complex_id=$2::uuid AND deleted_at IS NULL FOR UPDATE`, courtID, complexID).Scan(&result.Court.Name)
	if errors.Is(err, pgx.ErrNoRows) {
		return Reservation{}, ErrNotFound
	}
	if err != nil {
		return Reservation{}, err
	}
	if !start.After(time.Now()) {
		return Reservation{}, ErrConflict
	}
	duration, offered, err := slotcheck.Duration(ctx, tx, courtID, start)
	if err != nil {
		return Reservation{}, err
	}
	if !offered {
		return Reservation{}, ErrConflict
	}
	end := start.Add(time.Duration(duration) * time.Minute)
	var occupied bool
	err = tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM reservations WHERE court_id=$1::uuid AND status='reserved' AND starts_at < $3 AND ends_at > $2)`, courtID, start, end).Scan(&occupied)
	if err != nil {
		return Reservation{}, err
	}
	if occupied {
		return Reservation{}, ErrConflict
	}
	origin := "web"
	var organizer, companions any = actorID, 3
	if manual {
		origin, organizer, companions = "manual", nil, nil
	}
	err = tx.QueryRow(ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,starts_at,ends_at,status,companions,contact_name,contact_phone,origin,registered_by)
		VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,'reserved',$6,$7,$8,$9,$10::uuid) RETURNING id::text`, complexID, courtID, organizer, start, end, companions, input.Contact.Name, input.Contact.Phone, origin, actorID).Scan(&result.ID)
	if err != nil {
		return Reservation{}, err
	}
	result.EndsAt = end.Format("15:04")
	if !manual {
		payload, err := json.Marshal(result)
		if err != nil {
			return Reservation{}, err
		}
		_, err = tx.Exec(ctx, `INSERT INTO reservation_notices(user_id,reservation_id,kind,payload) VALUES($1::uuid,$2::uuid,'reservation_confirmed',$3::jsonb)`, actorID, result.ID, string(payload))
		if err != nil {
			return Reservation{}, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return Reservation{}, err
	}
	return result, nil
}
