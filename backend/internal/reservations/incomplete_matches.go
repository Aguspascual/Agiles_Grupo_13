package reservations

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

const incompleteMatchReleaseWindow = 4 * time.Hour

type courtKey struct {
	complexID string
	courtID   string
}

// ExpireIncompleteMatches releases open-match reservations once they are strictly
// inside the four-hour window. It also runs after the API restarts, including for
// matches whose start time has already passed.
func (r *Repository) ExpireIncompleteMatches(ctx context.Context, now time.Time) (int, error) {
	rows, err := r.db.Query(ctx, `SELECT DISTINCT r.complex_id::text,r.court_id::text
		FROM pending_matches pm JOIN reservations r ON r.id=pm.reservation_id
		WHERE pm.status='open' AND r.status='reserved' AND r.starts_at < $1
		ORDER BY 1,2`, now.Add(incompleteMatchReleaseWindow))
	if err != nil {
		return 0, err
	}
	courts := make([]courtKey, 0)
	for rows.Next() {
		var court courtKey
		if err := rows.Scan(&court.complexID, &court.courtID); err != nil {
			rows.Close()
			return 0, err
		}
		courts = append(courts, court)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return 0, err
	}
	rows.Close()

	expired := 0
	for _, court := range courts {
		tx, err := r.db.Begin(ctx)
		if err != nil {
			return expired, err
		}
		if err := lockCourtForMatchExpiration(ctx, tx, court.complexID, court.courtID); err != nil {
			tx.Rollback(ctx)
			return expired, err
		}
		count, err := r.ExpireIncompleteMatchesOnCourt(ctx, tx, court.courtID, now)
		if err != nil {
			tx.Rollback(ctx)
			return expired, err
		}
		if err := tx.Commit(ctx); err != nil {
			return expired, err
		}
		expired += count
	}
	return expired, nil
}

// ExpireIncompleteMatchesOnCourt expects the caller to hold the complex's
// FOR SHARE and court's FOR UPDATE locks, matching the reservation write order.
func (r *Repository) ExpireIncompleteMatchesOnCourt(ctx context.Context, tx pgx.Tx, courtID string, now time.Time) (int, error) {
	rows, err := tx.Query(ctx, `SELECT pm.id::text,r.id::text
		FROM pending_matches pm JOIN reservations r ON r.id=pm.reservation_id
		WHERE r.court_id=$1::uuid AND pm.status='open' AND r.status='reserved'
		AND r.starts_at < $2 ORDER BY r.starts_at,r.id`, courtID, now.Add(incompleteMatchReleaseWindow))
	if err != nil {
		return 0, err
	}
	type matchReservation struct{ matchID, reservationID string }
	items := make([]matchReservation, 0)
	for rows.Next() {
		var item matchReservation
		if err := rows.Scan(&item.matchID, &item.reservationID); err != nil {
			rows.Close()
			return 0, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return 0, err
	}
	rows.Close()

	expired := 0
	for _, item := range items {
		var reservationStatus string
		var startsAt time.Time
		err := tx.QueryRow(ctx, `SELECT status,starts_at FROM reservations WHERE id=$1::uuid FOR UPDATE`, item.reservationID).Scan(&reservationStatus, &startsAt)
		if err != nil {
			return expired, err
		}
		var matchStatus string
		if err := tx.QueryRow(ctx, `SELECT status FROM pending_matches WHERE id=$1::uuid FOR UPDATE`, item.matchID).Scan(&matchStatus); err != nil {
			return expired, err
		}
		if reservationStatus != "reserved" || matchStatus != "open" || !startsAt.Before(now.Add(incompleteMatchReleaseWindow)) {
			continue
		}
		var players int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM pending_match_players WHERE match_id=$1::uuid`, item.matchID).Scan(&players); err != nil {
			return expired, err
		}
		if players >= 4 {
			continue
		}
		if _, err := tx.Exec(ctx, `UPDATE reservations SET status='cancelled' WHERE id=$1::uuid AND status='reserved'`, item.reservationID); err != nil {
			return expired, err
		}
		if _, err := tx.Exec(ctx, `UPDATE pending_matches SET status='cancelled' WHERE id=$1::uuid AND status='open'`, item.matchID); err != nil {
			return expired, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO pending_match_notices(match_id,user_id,kind)
			SELECT match_id,user_id,'match_cancelled' FROM pending_match_players
			WHERE match_id=$1::uuid ON CONFLICT DO NOTHING`, item.matchID); err != nil {
			return expired, err
		}
		expired++
	}
	return expired, nil
}

func lockCourtForMatchExpiration(ctx context.Context, tx pgx.Tx, complexID, courtID string) error {
	var id string
	if err := tx.QueryRow(ctx, `SELECT id::text FROM complexes WHERE id=$1::uuid FOR SHARE`, complexID).Scan(&id); err != nil {
		return err
	}
	return tx.QueryRow(ctx, `SELECT id::text FROM courts WHERE id=$1::uuid AND complex_id=$2::uuid FOR UPDATE`, courtID, complexID).Scan(&id)
}
