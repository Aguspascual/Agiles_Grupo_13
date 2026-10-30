package reservations

import (
	"context"
	"errors"
	"net/mail"
	"strings"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
	"github.com/jackc/pgx/v5"
)

const FullMatchInvitationTTL = 30 * time.Minute

type FullMatchInviteInput struct {
	Name   string `json:"name"`
	Email  string `json:"email"`
	UserID string `json:"userId"`
}

type CreateFullMatchRequest struct {
	Date     string                 `json:"date"`
	StartsAt string                 `json:"startsAt"`
	Phone    string                 `json:"phone"`
	Invites  []FullMatchInviteInput `json:"invites"`
}

type FullMatchInvitation struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Email  string `json:"email,omitempty"`
	Status string `json:"status"`
	Token  string `json:"token,omitempty"`
}

type FullMatch struct {
	ID        string                `json:"id"`
	Status    string                `json:"status"`
	Complex   string                `json:"complex"`
	Court     string                `json:"court"`
	Date      string                `json:"date"`
	StartsAt  string                `json:"startsAt"`
	EndsAt    string                `json:"endsAt"`
	ExpiresAt time.Time             `json:"expiresAt"`
	Invites   []FullMatchInvitation `json:"invitations"`
}

func (r *CreateFullMatchRequest) Validate(now time.Time, location *time.Location) (time.Time, error) {
	r.Date, r.StartsAt, r.Phone = strings.TrimSpace(r.Date), strings.TrimSpace(r.StartsAt), strings.TrimSpace(r.Phone)
	if len(r.Date) != 10 || minutes(r.StartsAt) < 0 || r.Phone == "" || len(r.Phone) > 40 || len(r.Invites) != 3 {
		return time.Time{}, ErrInvalid
	}
	start, err := time.ParseInLocation("2006-01-02 15:04", r.Date+" "+r.StartsAt, location)
	if err != nil || start.Format("2006-01-02 15:04") != r.Date+" "+r.StartsAt {
		return time.Time{}, ErrInvalid
	}
	if !start.After(now) || start.Before(now.Add(FullMatchInvitationTTL)) {
		return time.Time{}, ErrConflict
	}
	seenEmails := map[string]struct{}{}
	for i := range r.Invites {
		invite := &r.Invites[i]
		invite.Name, invite.Email, invite.UserID = strings.TrimSpace(invite.Name), strings.ToLower(strings.TrimSpace(invite.Email)), strings.TrimSpace(invite.UserID)
		if invite.Name == "" || len(invite.Name) > 120 {
			return time.Time{}, ErrInvalid
		}
		if invite.UserID != "" && !auth.ValidUUID(invite.UserID) {
			return time.Time{}, ErrInvalid
		}
		if invite.Email != "" {
			address, parseErr := mail.ParseAddress(invite.Email)
			if parseErr != nil || address.Address != invite.Email || len(invite.Email) > 254 {
				return time.Time{}, ErrInvalid
			}
			if _, exists := seenEmails[invite.Email]; exists {
				return time.Time{}, ErrInvalid
			}
			seenEmails[invite.Email] = struct{}{}
		}
	}
	return start, nil
}

func (r *Repository) CreateFullMatch(ctx context.Context, complexID, courtID, actorID string, input CreateFullMatchRequest, start, now time.Time, location *time.Location) (FullMatch, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return FullMatch{}, err
	}
	defer tx.Rollback(ctx)
	result := FullMatch{Status: "pending", Date: start.In(location).Format("2006-01-02"), StartsAt: start.In(location).Format("15:04")}
	var organizerName string
	if err := tx.QueryRow(ctx, `SELECT name FROM player_profiles WHERE user_id=$1::uuid`, actorID).Scan(&organizerName); errors.Is(err, pgx.ErrNoRows) {
		return FullMatch{}, ErrNotFound
	} else if err != nil {
		return FullMatch{}, err
	}
	var organizerEmail string
	if err := tx.QueryRow(ctx, `SELECT email FROM users WHERE id=$1::uuid`, actorID).Scan(&organizerEmail); err != nil {
		return FullMatch{}, err
	}
	seenEmails := map[string]struct{}{}
	seenUsers := map[string]struct{}{}
	for i := range input.Invites {
		invite := &input.Invites[i]
		if invite.UserID != "" {
			if invite.UserID == actorID {
				return FullMatch{}, ErrInvalid
			}
			if _, duplicate := seenUsers[invite.UserID]; duplicate {
				return FullMatch{}, ErrInvalid
			}
			seenUsers[invite.UserID] = struct{}{}
			if err := tx.QueryRow(ctx, `SELECT p.name,u.email FROM users u JOIN player_profiles p ON p.user_id=u.id WHERE u.id=$1::uuid`, invite.UserID).Scan(&invite.Name, &invite.Email); errors.Is(err, pgx.ErrNoRows) {
				return FullMatch{}, ErrNotFound
			} else if err != nil {
				return FullMatch{}, err
			}
			invite.Email = strings.ToLower(invite.Email)
		}
		if invite.Email != "" && strings.EqualFold(invite.Email, organizerEmail) {
			return FullMatch{}, ErrInvalid
		}
		if invite.Email != "" {
			if _, duplicate := seenEmails[invite.Email]; duplicate {
				return FullMatch{}, ErrInvalid
			}
			seenEmails[invite.Email] = struct{}{}
		}
	}
	if err := tx.QueryRow(ctx, `SELECT name FROM complexes WHERE id=$1::uuid AND deleted_at IS NULL FOR SHARE`, complexID).Scan(&result.Complex); errors.Is(err, pgx.ErrNoRows) {
		return FullMatch{}, ErrNotFound
	} else if err != nil {
		return FullMatch{}, err
	}
	if err := tx.QueryRow(ctx, `SELECT name FROM courts WHERE id=$1::uuid AND complex_id=$2::uuid AND deleted_at IS NULL FOR UPDATE`, courtID, complexID).Scan(&result.Court); errors.Is(err, pgx.ErrNoRows) {
		return FullMatch{}, ErrNotFound
	} else if err != nil {
		return FullMatch{}, err
	}
	weekday := int(start.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	var dayID string
	var duration int
	var enabled bool
	err = tx.QueryRow(ctx, `SELECT id::text,enabled,duration_minutes FROM court_schedule_days WHERE court_id=$1::uuid AND weekday=$2`, courtID, weekday).Scan(&dayID, &enabled, &duration)
	if errors.Is(err, pgx.ErrNoRows) || (!enabled && err == nil) {
		return FullMatch{}, ErrConflict
	}
	if err != nil {
		return FullMatch{}, err
	}
	rows, err := tx.Query(ctx, `SELECT substring(opens_at::text from 1 for 5),substring(closes_at::text from 1 for 5) FROM court_schedule_intervals WHERE schedule_day_id=$1::uuid`, dayID)
	if err != nil {
		return FullMatch{}, err
	}
	var intervals []Interval
	for rows.Next() {
		var interval Interval
		if err := rows.Scan(&interval.Open, &interval.Close); err != nil {
			rows.Close()
			return FullMatch{}, err
		}
		intervals = append(intervals, interval)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return FullMatch{}, err
	}
	if !slotWithinSchedule(input.StartsAt, duration, intervals) || !start.After(now) {
		return FullMatch{}, ErrConflict
	}
	end := start.Add(time.Duration(duration) * time.Minute)
	var occupied bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM reservations WHERE court_id=$1::uuid AND status='reserved' AND starts_at < $3 AND ends_at > $2)`, courtID, start, end).Scan(&occupied); err != nil {
		return FullMatch{}, err
	}
	if occupied {
		return FullMatch{}, ErrConflict
	}
	var reservationID string
	if err := tx.QueryRow(ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,starts_at,ends_at,status,companions,contact_name,contact_phone,origin,registered_by)
		VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,'reserved',3,$6,$7,'full_match',$3::uuid) RETURNING id::text`, complexID, courtID, actorID, start, end, organizerName, input.Phone).Scan(&reservationID); err != nil {
		return FullMatch{}, err
	}
	result.ExpiresAt = now.Add(FullMatchInvitationTTL)
	if err := tx.QueryRow(ctx, `INSERT INTO full_matches(reservation_id,organizer_id,status,expires_at,created_at) VALUES($1::uuid,$2::uuid,'pending',$3,$4) RETURNING id::text`, reservationID, actorID, result.ExpiresAt, now).Scan(&result.ID); err != nil {
		return FullMatch{}, err
	}
	result.EndsAt = end.In(location).Format("15:04")
	result.Invites = make([]FullMatchInvitation, 0, 3)
	for _, invite := range input.Invites {
		token, tokenHash, err := newInvitationToken()
		if err != nil {
			return FullMatch{}, err
		}
		var id string
		if err := tx.QueryRow(ctx, `INSERT INTO full_match_invitations(match_id,invited_name,invited_email,invited_user_id,token_hash,status)
			VALUES($1::uuid,$2,NULLIF($3,''),NULLIF($4,'')::uuid,$5,'pending') RETURNING id::text`, result.ID, invite.Name, invite.Email, invite.UserID, tokenHash[:]).Scan(&id); err != nil {
			return FullMatch{}, err
		}
		result.Invites = append(result.Invites, FullMatchInvitation{ID: id, Name: invite.Name, Email: invite.Email, Status: "pending", Token: token})
	}
	if _, err := tx.Exec(ctx, `INSERT INTO reservation_notices(user_id,reservation_id,kind,payload)
		VALUES($1::uuid,$2::uuid,'reservation_confirmed',jsonb_build_object(
		'id',$2::text,'status','reserved','complex',jsonb_build_object('id',$3::text,'name',$4::text),
		'court',jsonb_build_object('id',$5::text,'name',$6::text),'date',$7::text,'startsAt',$8::text,'endsAt',$9::text,
		'timeZone','America/Argentina/Buenos_Aires'))`, actorID, reservationID, complexID, result.Complex, courtID, result.Court, result.Date, result.StartsAt, result.EndsAt); err != nil {
		return FullMatch{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return FullMatch{}, err
	}
	return result, nil
}
