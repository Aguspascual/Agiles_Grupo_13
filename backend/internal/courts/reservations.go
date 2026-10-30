package courts

import (
	"context"

	"github.com/jackc/pgx/v5"
)

type postgresReservationChecker struct{}

func (postgresReservationChecker) HasFutureReservations(ctx context.Context, tx pgx.Tx, courtID string) (bool, error) {
	var exists bool
	err := tx.QueryRow(ctx, `SELECT EXISTS (
		SELECT 1 FROM reservations
		WHERE court_id=$1::uuid AND status='reserved' AND ends_at > statement_timestamp()
	)`, courtID).Scan(&exists)
	return exists, err
}
