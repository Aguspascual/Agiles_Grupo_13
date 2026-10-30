package reservations

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// CancellationWindow is the minimum notice a player needs to cancel (RN-02, inclusive).
const CancellationWindow = 4 * time.Hour

var (
	// ErrTooLate: the player asked less than CancellationWindow before the start.
	ErrTooLate = errors.New("cancellation window closed")
	// ErrFinished: a manager asked after the reservation already ended.
	ErrFinished = errors.New("reservation finished")
)

type cancelRequest struct {
	reservationID string
	actorID       string
	// complexID is set for the manager policy and empty for the player policy.
	complexID string
	location  *time.Location
}

// CancelOwn cancels a web reservation organized by the actor (TDD-0010, C3).
func (r *Repository) CancelOwn(ctx context.Context, reservationID, actorID string, location *time.Location) (Reservation, error) {
	return r.cancel(ctx, cancelRequest{reservationID: reservationID, actorID: actorID, location: location})
}

// CancelAsManager cancels any live reservation of a complex for an administrator or its manager (TDD-0016, C2).
func (r *Repository) CancelAsManager(ctx context.Context, complexID, reservationID, actorID string, location *time.Location) (Reservation, error) {
	return r.cancel(ctx, cancelRequest{reservationID: reservationID, actorID: actorID, complexID: complexID, location: location})
}

// cancel takes locks in the order complex FOR SHARE, court FOR UPDATE, reservation FOR UPDATE.
func (r *Repository) cancel(ctx context.Context, in cancelRequest) (Reservation, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Reservation{}, err
	}
	defer tx.Rollback(ctx)
	manager := in.complexID != ""
	complexID := in.complexID
	var courtID string
	if !manager {
		err = tx.QueryRow(ctx, `SELECT complex_id::text, court_id::text FROM reservations WHERE id=$1::uuid`, in.reservationID).Scan(&complexID, &courtID)
		if errors.Is(err, pgx.ErrNoRows) {
			return Reservation{}, ErrNotFound
		}
		if err != nil {
			return Reservation{}, err
		}
	}
	result := Reservation{ID: in.reservationID, Status: "cancelled", Complex: NamedResource{ID: complexID}, TimeZone: "America/Argentina/Buenos_Aires"}
	if manager {
		err = tx.QueryRow(ctx, `SELECT name FROM complexes WHERE id=$1::uuid AND deleted_at IS NULL FOR SHARE`, complexID).Scan(&result.Complex.Name)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return Reservation{}, err
		}
		if authErr := authorizeManual(ctx, tx, complexID, in.actorID, errors.Is(err, pgx.ErrNoRows)); authErr != nil {
			return Reservation{}, authErr
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return Reservation{}, ErrNotFound
		}
		err = tx.QueryRow(ctx, `SELECT court_id::text FROM reservations WHERE id=$1::uuid AND complex_id=$2::uuid`, in.reservationID, complexID).Scan(&courtID)
		if errors.Is(err, pgx.ErrNoRows) {
			return Reservation{}, ErrNotFound
		}
		if err != nil {
			return Reservation{}, err
		}
	} else {
		err = tx.QueryRow(ctx, `SELECT name FROM complexes WHERE id=$1::uuid FOR SHARE`, complexID).Scan(&result.Complex.Name)
		if err != nil {
			return Reservation{}, err
		}
	}
	err = tx.QueryRow(ctx, `SELECT name FROM courts WHERE id=$1::uuid AND complex_id=$2::uuid FOR UPDATE`, courtID, complexID).Scan(&result.Court.Name)
	if err != nil {
		return Reservation{}, err
	}
	result.Court.ID = courtID
	var status, origin string
	var organizer *string
	var startsAt, endsAt time.Time
	err = tx.QueryRow(ctx, `SELECT status, origin, organizer_id::text, starts_at, ends_at FROM reservations WHERE id=$1::uuid AND complex_id=$2::uuid FOR UPDATE`,
		in.reservationID, complexID).Scan(&status, &origin, &organizer, &startsAt, &endsAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Reservation{}, ErrNotFound
	}
	if err != nil {
		return Reservation{}, err
	}
	if !manager && (origin != "web" || organizer == nil || *organizer != in.actorID) {
		return Reservation{}, ErrNotFound
	}
	local := startsAt.In(in.location)
	result.Date, result.StartsAt, result.EndsAt = local.Format("2006-01-02"), local.Format("15:04"), endsAt.In(in.location).Format("15:04")
	if status == "cancelled" {
		return result, nil
	}
	now := r.now()
	if manager && !managerMayCancel(now, endsAt) {
		return Reservation{}, ErrFinished
	}
	if !manager && !playerMayCancel(now, startsAt) {
		return Reservation{}, ErrTooLate
	}
	tag, err := tx.Exec(ctx, `UPDATE reservations SET status='cancelled' WHERE id=$1::uuid AND status='reserved'`, in.reservationID)
	if err != nil {
		return Reservation{}, err
	}
	if tag.RowsAffected() != 1 {
		return Reservation{}, ErrConflict
	}
	if organizer != nil {
		payload, err := json.Marshal(result)
		if err != nil {
			return Reservation{}, err
		}
		_, err = tx.Exec(ctx, `INSERT INTO reservation_notices(user_id,reservation_id,kind,payload) VALUES($1::uuid,$2::uuid,'reservation_cancelled',$3::jsonb)
			ON CONFLICT (reservation_id, kind) DO NOTHING`, *organizer, in.reservationID, string(payload))
		if err != nil {
			return Reservation{}, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return Reservation{}, err
	}
	return result, nil
}

// playerMayCancel applies RN-02: allowed while now <= starts_at - 4h, limit included, no rounding.
func playerMayCancel(now, startsAt time.Time) bool {
	return !now.After(startsAt.Add(-CancellationWindow))
}

// managerMayCancel allows any reservation that has not ended yet (TDD-0016 CA-02).
func managerMayCancel(now, endsAt time.Time) bool {
	return endsAt.After(now)
}