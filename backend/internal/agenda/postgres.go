package agenda

import (
	"context"
	"errors"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/reservations"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/slots"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct{ db *pgxpool.Pool }

func NewRepository(db *pgxpool.Pool) *Repository { return &Repository{db: db} }

// Read authorizes the actor and reads the day inside one transaction. Reads need FOR SHARE
// on the complex, so the transaction cannot be read-only.
func (r *Repository) Read(ctx context.Context, complexID, actorID string, dayStart, dayEnd time.Time, weekday int) (Snapshot, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Snapshot{}, err
	}
	defer tx.Rollback(context.Background())
	var snapshot Snapshot
	err = tx.QueryRow(ctx, `SELECT id::text,name,address,zone FROM complexes WHERE id=$1::uuid AND deleted_at IS NULL FOR SHARE`, complexID).
		Scan(&snapshot.Complex.ID, &snapshot.Complex.Name, &snapshot.Complex.Address, &snapshot.Complex.Zone)
	missing := errors.Is(err, pgx.ErrNoRows)
	if err != nil && !missing {
		return Snapshot{}, err
	}
	if authErr := reservations.AuthorizeManager(ctx, tx, complexID, actorID, missing); authErr != nil {
		switch {
		case errors.Is(authErr, reservations.ErrForbidden):
			return Snapshot{}, ErrForbidden
		case errors.Is(authErr, reservations.ErrNotFound):
			return Snapshot{}, ErrNotFound
		}
		return Snapshot{}, authErr
	}
	if missing {
		return Snapshot{}, ErrNotFound
	}
	if snapshot.Courts, err = slots.ReadCourtData(ctx, tx, complexID, weekday); err != nil {
		return Snapshot{}, err
	}
	rows, err := tx.Query(ctx, `SELECT r.id::text,r.court_id::text,r.origin,r.contact_name,r.contact_phone,r.starts_at,r.ends_at
		FROM reservations r JOIN courts c ON c.id=r.court_id
		WHERE c.complex_id=$1::uuid AND c.deleted_at IS NULL AND r.status='reserved'
		AND r.starts_at < $3 AND r.ends_at > $2 ORDER BY r.starts_at,r.ends_at,r.id`, complexID, dayStart, dayEnd)
	if err != nil {
		return Snapshot{}, err
	}
	defer rows.Close()
	snapshot.Reservations = []ReservationData{}
	for rows.Next() {
		var item ReservationData
		if err := rows.Scan(&item.ID, &item.CourtID, &item.Origin, &item.Contact.Name, &item.Contact.Phone, &item.StartsAt, &item.EndsAt); err != nil {
			return Snapshot{}, err
		}
		snapshot.Reservations = append(snapshot.Reservations, item)
	}
	if err := rows.Err(); err != nil {
		return Snapshot{}, err
	}
	rows.Close()
	if err := tx.Commit(ctx); err != nil {
		return Snapshot{}, err
	}
	if snapshot.Courts == nil {
		snapshot.Courts = []slots.CourtData{}
	}
	return snapshot, nil
}
