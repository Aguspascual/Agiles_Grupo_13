package reservations

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func newInvitationToken() (string, [32]byte, error) {
	var raw [32]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", [32]byte{}, err
	}
	return base64.RawURLEncoding.EncodeToString(raw[:]), sha256.Sum256(raw[:]), nil
}

func invitationHash(token string) ([32]byte, error) {
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil || len(decoded) != 32 {
		return [32]byte{}, ErrInvalid
	}
	return sha256.Sum256(decoded), nil
}

func (r *Repository) GetFullMatch(ctx context.Context, matchID, organizerID string, location *time.Location) (FullMatch, error) {
	var result FullMatch
	var startsAt, endsAt time.Time
	err := r.db.QueryRow(ctx, `SELECT fm.id::text,fm.status,cx.name,court.name,r.starts_at,r.ends_at,fm.expires_at
		FROM full_matches fm JOIN reservations r ON r.id=fm.reservation_id JOIN complexes cx ON cx.id=r.complex_id JOIN courts court ON court.id=r.court_id
		WHERE fm.id=$1::uuid AND fm.organizer_id=$2::uuid`, matchID, organizerID).
		Scan(&result.ID, &result.Status, &result.Complex, &result.Court, &startsAt, &endsAt, &result.ExpiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return FullMatch{}, ErrNotFound
	}
	if err != nil {
		return FullMatch{}, err
	}
	result.Date, result.StartsAt, result.EndsAt = startsAt.In(location).Format("2006-01-02"), startsAt.In(location).Format("15:04"), endsAt.In(location).Format("15:04")
	rows, err := r.db.Query(ctx, `SELECT id::text,invited_name,COALESCE(invited_email,''),status FROM full_match_invitations WHERE match_id=$1::uuid ORDER BY created_at,id`, matchID)
	if err != nil {
		return FullMatch{}, err
	}
	defer rows.Close()
	result.Invites = make([]FullMatchInvitation, 0, 3)
	for rows.Next() {
		var invite FullMatchInvitation
		if err := rows.Scan(&invite.ID, &invite.Name, &invite.Email, &invite.Status); err != nil {
			return FullMatch{}, err
		}
		result.Invites = append(result.Invites, invite)
	}
	return result, rows.Err()
}

func (r *Repository) GetInvitation(ctx context.Context, token string, now time.Time, location *time.Location) (FullMatch, error) {
	hash, err := invitationHash(token)
	if err != nil {
		return FullMatch{}, err
	}
	var result FullMatch
	var startsAt, endsAt time.Time
	var invite FullMatchInvitation
	err = r.db.QueryRow(ctx, `SELECT fm.id::text,fm.status,cx.name,court.name,r.starts_at,r.ends_at,fm.expires_at,
		fmi.id::text,fmi.invited_name,fmi.status
		FROM full_match_invitations fmi JOIN full_matches fm ON fm.id=fmi.match_id
		JOIN reservations r ON r.id=fm.reservation_id JOIN complexes cx ON cx.id=r.complex_id JOIN courts court ON court.id=r.court_id
		WHERE fmi.token_hash=$1`, hash[:]).Scan(&result.ID, &result.Status, &result.Complex, &result.Court, &startsAt, &endsAt, &result.ExpiresAt, &invite.ID, &invite.Name, &invite.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return FullMatch{}, ErrNotFound
	}
	if err != nil {
		return FullMatch{}, err
	}
	if result.Status == "pending" && !result.ExpiresAt.After(now) {
		return FullMatch{}, ErrConflict
	}
	result.Date, result.StartsAt, result.EndsAt = startsAt.In(location).Format("2006-01-02"), startsAt.In(location).Format("15:04"), endsAt.In(location).Format("15:04")
	result.Invites = []FullMatchInvitation{invite}
	return result, nil
}

func (r *Repository) AcceptInvitation(ctx context.Context, token, actorID, email string, now time.Time, location *time.Location) (FullMatch, error) {
	hash, err := invitationHash(token)
	if err != nil {
		return FullMatch{}, err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return FullMatch{}, err
	}
	defer tx.Rollback(ctx)
	var matchID, status, organizerID string
	var expiresAt time.Time
	err = tx.QueryRow(ctx, `SELECT fm.id::text,fm.status,fm.organizer_id::text,fm.expires_at FROM full_match_invitations fmi
		JOIN full_matches fm ON fm.id=fmi.match_id WHERE fmi.token_hash=$1 FOR UPDATE OF fm`, hash[:]).Scan(&matchID, &status, &organizerID, &expiresAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return FullMatch{}, ErrNotFound
	}
	if err != nil {
		return FullMatch{}, err
	}
	if status != "pending" || !expiresAt.After(now) {
		return FullMatch{}, ErrConflict
	}
	if actorID == organizerID {
		return FullMatch{}, ErrConflict
	}
	var invitationStatus, acceptedUser, invitedUser string
	var invitedEmail string
	err = tx.QueryRow(ctx, `SELECT status,COALESCE(invited_email,''),COALESCE(invited_user_id::text,''),COALESCE(accepted_user_id::text,'') FROM full_match_invitations WHERE token_hash=$1 FOR UPDATE`, hash[:]).Scan(&invitationStatus, &invitedEmail, &invitedUser, &acceptedUser)
	if err != nil {
		return FullMatch{}, err
	}
	if invitationStatus == "accepted" && acceptedUser == actorID {
		if err := tx.Commit(ctx); err != nil {
			return FullMatch{}, err
		}
		return r.GetFullMatch(ctx, matchID, organizerID, location)
	}
	if invitationStatus != "pending" {
		return FullMatch{}, ErrConflict
	}
	if invitedUser != "" && invitedUser != actorID {
		return FullMatch{}, ErrForbidden
	}
	if invitedUser == "" && invitedEmail != "" && !strings.EqualFold(invitedEmail, email) {
		return FullMatch{}, ErrForbidden
	}
	var alreadyAccepted bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM full_match_invitations WHERE match_id=$1::uuid AND accepted_user_id=$2::uuid)`, matchID, actorID).Scan(&alreadyAccepted); err != nil {
		return FullMatch{}, err
	}
	if alreadyAccepted {
		return FullMatch{}, ErrDuplicate
	}
	command, err := tx.Exec(ctx, `UPDATE full_match_invitations SET status='accepted',accepted_user_id=$2::uuid,accepted_at=$3 WHERE token_hash=$1 AND status='pending'`, hash[:], actorID, now)
	if isUniqueViolation(err) {
		return FullMatch{}, ErrDuplicate
	}
	if err != nil {
		return FullMatch{}, err
	}
	if command.RowsAffected() != 1 {
		return FullMatch{}, ErrConflict
	}
	var count int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM full_match_invitations WHERE match_id=$1::uuid AND status='accepted'`, matchID).Scan(&count); err != nil {
		return FullMatch{}, err
	}
	if count == 3 {
		if _, err := tx.Exec(ctx, `UPDATE full_matches SET status='full',completed_at=$2 WHERE id=$1::uuid AND status='pending'`, matchID, now); err != nil {
			return FullMatch{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return FullMatch{}, err
	}
	return r.GetFullMatch(ctx, matchID, organizerID, location)
}

func (r *Repository) ExpireFullMatches(ctx context.Context, now time.Time) (int, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	rows, err := tx.Query(ctx, `SELECT id::text,reservation_id::text FROM full_matches WHERE status='pending' AND expires_at <= $1 FOR UPDATE SKIP LOCKED`, now)
	if err != nil {
		return 0, err
	}
	type expired struct{ matchID, reservationID string }
	var items []expired
	for rows.Next() {
		var item expired
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
	for _, item := range items {
		if _, err := tx.Exec(ctx, `UPDATE reservations SET status='cancelled' WHERE id=$1::uuid AND status='reserved'`, item.reservationID); err != nil {
			return 0, err
		}
		if _, err := tx.Exec(ctx, `UPDATE full_matches SET status='expired' WHERE id=$1::uuid`, item.matchID); err != nil {
			return 0, err
		}
		if _, err := tx.Exec(ctx, `UPDATE full_match_invitations SET status='expired' WHERE match_id=$1::uuid AND status='pending'`, item.matchID); err != nil {
			return 0, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return len(items), nil
}

func (r *Repository) inviteEmail(ctx context.Context, actorID string) (string, error) {
	var email string
	if err := r.db.QueryRow(ctx, `SELECT email FROM users WHERE id=$1::uuid`, actorID).Scan(&email); err != nil {
		return "", fmt.Errorf("read current user email: %w", err)
	}
	return email, nil
}

func isUniqueViolation(err error) bool {
	var pgError *pgconn.PgError
	return errors.As(err, &pgError) && pgError.Code == "23505"
}
