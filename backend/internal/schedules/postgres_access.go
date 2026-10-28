package schedules

import (
	"context"
	"errors"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/complexes"
	"github.com/jackc/pgx/v5"
)

// Mutations serialize on the court, matching court deletion's existing lock.
// Real reservation creation must acquire that same lock before inspecting/booking.
func (r *PostgresRepository) authorizedTransaction(ctx context.Context, complexID, courtID, actorID string, admin, write bool) (pgx.Tx, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	if err := authorize(ctx, tx, complexID, courtID, actorID, admin, write); err != nil {
		_ = tx.Rollback(ctx)
		return nil, err
	}
	return tx, nil
}

func authorize(ctx context.Context, tx pgx.Tx, complexID, courtID, actorID string, admin, write bool) error {
	err := complexes.AuthorizeInTransaction(ctx, tx, complexID, actorID, admin)
	if errors.Is(err, complexes.ErrNotFound) {
		return ErrNotFound
	}
	if errors.Is(err, complexes.ErrForbidden) {
		return ErrForbidden
	}
	if err != nil {
		return err
	}
	var exists bool
	lock := "FOR SHARE"
	if write {
		lock = "FOR UPDATE"
	}
	err = tx.QueryRow(ctx, "SELECT true FROM courts WHERE id=$1::uuid AND complex_id=$2::uuid AND deleted_at IS NULL "+lock, courtID, complexID).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}
