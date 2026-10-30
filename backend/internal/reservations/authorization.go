package reservations

import (
	"context"
	"errors"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/complexes"
	"github.com/jackc/pgx/v5"
)

// The caller already holds the complex lock. Retain the current role until commit,
// and reuse administrative membership authorization under that same transaction.
func authorizeManual(ctx context.Context, tx pgx.Tx, complexID, actorID string, missing bool) error {
	var admin bool
	if err := tx.QueryRow(ctx, `SELECT role='ADMIN' FROM users WHERE id=$1::uuid FOR SHARE`, actorID).Scan(&admin); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrForbidden
		}
		return err
	}
	// An unassigned actor must not learn whether the requested complex exists.
	if missing && !admin {
		var assigned bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM complex_managers WHERE complex_id=$1::uuid AND user_id=$2::uuid)`, complexID, actorID).Scan(&assigned); err != nil {
			return err
		}
		if !assigned {
			return ErrForbidden
		}
	}
	err := complexes.AuthorizeInTransaction(ctx, tx, complexID, actorID, admin)
	switch {
	case errors.Is(err, complexes.ErrForbidden):
		return ErrForbidden
	case errors.Is(err, complexes.ErrNotFound):
		return ErrNotFound
	default:
		return err
	}
}
