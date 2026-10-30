package matches

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct{ db *pgxpool.Pool }

func NewRepository(db *pgxpool.Pool) *Repository { return &Repository{db: db} }

func (r *Repository) ListOptions(ctx context.Context) ([]ComplexOption, error) {
	rows, err := r.db.Query(ctx, `SELECT cx.id::text,cx.name,cx.address,cx.zone,court.id::text,court.name,court.covered,court.has_lighting
		FROM complexes cx JOIN courts court ON court.complex_id=cx.id
		WHERE cx.deleted_at IS NULL AND court.deleted_at IS NULL
		ORDER BY cx.name,court.name,court.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]ComplexOption, 0)
	byID := make(map[string]int)
	for rows.Next() {
		var complex ComplexOption
		var court CourtOption
		if err := rows.Scan(&complex.ID, &complex.Name, &complex.Address, &complex.Zone,
			&court.ID, &court.Name, &court.Covered, &court.Lighting); err != nil {
			return nil, err
		}
		index, exists := byID[complex.ID]
		if !exists {
			complex.Courts = make([]CourtOption, 0, 2)
			byID[complex.ID] = len(items)
			items = append(items, complex)
			index = byID[complex.ID]
		}
		items[index].Courts = append(items[index].Courts, court)
	}
	return items, rows.Err()
}

func (r *Repository) List(ctx context.Context, filters ListFilters, now time.Time, location *time.Location) ([]Match, error) {
	rows, err := r.db.Query(ctx, `SELECT pm.id::text, r.id::text, pm.status, cx.id::text, cx.name, cx.address, cx.zone,
		court.id::text, court.name, court.covered, court.has_lighting, r.starts_at, r.ends_at, pm.target_level,
		u.id::text, p.name, p.level, COALESCE(p.position,''), pmp.is_organizer
		FROM pending_matches pm
		JOIN reservations r ON r.id=pm.reservation_id
		JOIN complexes cx ON cx.id=r.complex_id AND cx.deleted_at IS NULL
		JOIN courts court ON court.id=r.court_id AND court.deleted_at IS NULL
		JOIN pending_match_players pmp ON pmp.match_id=pm.id
		JOIN users u ON u.id=pmp.user_id
		JOIN player_profiles p ON p.user_id=u.id
		WHERE (NOT $7 OR pm.status='open') AND r.status='reserved' AND r.starts_at > $1
		AND ($2::date IS NULL OR (r.starts_at AT TIME ZONE $5)::date=$2::date)
		AND (NULLIF($3,'') IS NULL OR r.complex_id=NULLIF($3,'')::uuid)
		AND (NULLIF($4,'') IS NULL OR pm.target_level=$4)
		AND (NULLIF($6,'') IS NULL OR pm.id::text=$6)
		ORDER BY r.starts_at,cx.name,court.name,pm.id,pmp.joined_at`, now, filters.Date, filters.ComplexID, filters.Level, location.String(), filters.MatchID, filters.OnlyOpen)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Match, 0)
	indexByID := make(map[string]int)
	for rows.Next() {
		var item Match
		var startsAt, endsAt time.Time
		var player Player
		if err := rows.Scan(&item.ID, &item.ReservationID, &item.Status, &item.ComplexID, &item.Complex,
			&item.Address, &item.Zone, &item.CourtID, &item.Court, &item.Covered, &item.Lighting,
			&startsAt, &endsAt, &item.TargetLevel, &player.ID, &player.Name, &player.Level, &player.Position, &player.Organizer); err != nil {
			return nil, err
		}
		if index, exists := indexByID[item.ID]; exists {
			items[index].Players = append(items[index].Players, player)
			items[index].Missing = 4 - len(items[index].Players)
			continue
		}
		item.Date = startsAt.In(location).Format("2006-01-02")
		item.StartsAt = startsAt.In(location).Format("15:04")
		item.EndsAt = endsAt.In(location).Format("15:04")
		item.Players = []Player{player}
		item.Missing = 3
		indexByID[item.ID] = len(items)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) Create(ctx context.Context, complexID, courtID, actorID string, input CreateRequest, start, now time.Time, location *time.Location) (Match, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Match{}, err
	}
	defer tx.Rollback(ctx)
	var result Match
	var organizerName, organizerLevel, organizerPosition string
	if err := tx.QueryRow(ctx, `SELECT p.name,p.level,COALESCE(p.position,'') FROM player_profiles p WHERE p.user_id=$1::uuid`, actorID).
		Scan(&organizerName, &organizerLevel, &organizerPosition); errors.Is(err, pgx.ErrNoRows) {
		return Match{}, ErrNotFound
	} else if err != nil {
		return Match{}, err
	}
	var address, zone string
	err = tx.QueryRow(ctx, `SELECT id::text,name,address,zone FROM complexes WHERE id=$1::uuid AND deleted_at IS NULL FOR SHARE`, complexID).
		Scan(&result.ComplexID, &result.Complex, &address, &zone)
	if errors.Is(err, pgx.ErrNoRows) {
		return Match{}, ErrNotFound
	}
	if err != nil {
		return Match{}, err
	}
	result.Address, result.Zone = address, zone
	err = tx.QueryRow(ctx, `SELECT id::text,name,covered,has_lighting FROM courts WHERE id=$1::uuid AND complex_id=$2::uuid AND deleted_at IS NULL FOR UPDATE`, courtID, complexID).
		Scan(&result.CourtID, &result.Court, &result.Covered, &result.Lighting)
	if errors.Is(err, pgx.ErrNoRows) {
		return Match{}, ErrNotFound
	}
	if err != nil {
		return Match{}, err
	}
	weekday := int(start.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	var dayID string
	var duration int
	var enabled bool
	err = tx.QueryRow(ctx, `SELECT id::text,enabled,duration_minutes FROM court_schedule_days WHERE court_id=$1::uuid AND weekday=$2`, courtID, weekday).
		Scan(&dayID, &enabled, &duration)
	if errors.Is(err, pgx.ErrNoRows) || (!enabled && err == nil) {
		return Match{}, ErrConflict
	}
	if err != nil {
		return Match{}, err
	}
	rows, err := tx.Query(ctx, `SELECT to_char(opens_at,'HH24:MI'),to_char(closes_at,'HH24:MI') FROM court_schedule_intervals WHERE schedule_day_id=$1::uuid`, dayID)
	if err != nil {
		return Match{}, err
	}
	validSlot := false
	startMinutes := start.Hour()*60 + start.Minute()
	for rows.Next() {
		var opens, closes string
		if err := rows.Scan(&opens, &closes); err != nil {
			rows.Close()
			return Match{}, err
		}
		openMinutes, closeMinutes := clockMinutes(opens), clockMinutes(closes)
		if startMinutes >= openMinutes && startMinutes+duration <= closeMinutes && (startMinutes-openMinutes)%duration == 0 {
			validSlot = true
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return Match{}, err
	}
	rows.Close()
	if !validSlot || !start.After(now) {
		return Match{}, ErrConflict
	}
	end := start.Add(time.Duration(duration) * time.Minute)
	var occupied bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM reservations WHERE court_id=$1::uuid AND status='reserved' AND starts_at < $3 AND ends_at > $2)`, courtID, start, end).Scan(&occupied); err != nil {
		return Match{}, err
	}
	if occupied {
		return Match{}, ErrConflict
	}
	err = tx.QueryRow(ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,starts_at,ends_at,status,companions,contact_name,contact_phone,origin,registered_by)
		VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,'reserved',3,$6,'','open_match',$3::uuid) RETURNING id::text`, complexID, courtID, actorID, start, end, organizerName).Scan(&result.ReservationID)
	if err != nil {
		return Match{}, err
	}
	err = tx.QueryRow(ctx, `INSERT INTO pending_matches(reservation_id,target_level,status) VALUES($1::uuid,$2,'open') RETURNING id::text`, result.ReservationID, input.TargetLevel).Scan(&result.ID)
	if err != nil {
		return Match{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO pending_match_players(match_id,user_id,is_organizer) VALUES($1::uuid,$2::uuid,true)`, result.ID, actorID); err != nil {
		return Match{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Match{}, err
	}
	result.Status, result.Date = "open", start.In(location).Format("2006-01-02")
	result.StartsAt, result.EndsAt = start.In(location).Format("15:04"), end.In(location).Format("15:04")
	result.TargetLevel = input.TargetLevel
	result.Players = []Player{{ID: actorID, Name: organizerName, Level: organizerLevel, Position: organizerPosition, Organizer: true}}
	result.Missing = 3
	return result, nil
}

func (r *Repository) Join(ctx context.Context, matchID, actorID string, now time.Time, location *time.Location) (Match, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Match{}, err
	}
	defer tx.Rollback(ctx)
	var status string
	var startsAt time.Time
	err = tx.QueryRow(ctx, `SELECT pm.status,r.starts_at FROM pending_matches pm JOIN reservations r ON r.id=pm.reservation_id WHERE pm.id=$1::uuid AND r.status='reserved' FOR UPDATE OF pm`, matchID).
		Scan(&status, &startsAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return Match{}, ErrNotFound
	}
	if err != nil {
		return Match{}, err
	}
	if status != "open" || !startsAt.After(now) {
		return Match{}, ErrConflict
	}
	var playerCount int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM pending_match_players WHERE match_id=$1::uuid`, matchID).Scan(&playerCount); err != nil {
		return Match{}, err
	}
	if playerCount >= 4 {
		return Match{}, ErrConflict
	}
	var name, level string
	var position string
	err = tx.QueryRow(ctx, `SELECT name,level,COALESCE(position,'') FROM player_profiles WHERE user_id=$1::uuid`, actorID).Scan(&name, &level, &position)
	if errors.Is(err, pgx.ErrNoRows) {
		return Match{}, ErrNotFound
	}
	if err != nil {
		return Match{}, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO pending_match_players(match_id,user_id) VALUES($1::uuid,$2::uuid)`, matchID, actorID)
	if err != nil {
		if isUniqueViolation(err) {
			return Match{}, ErrDuplicate
		}
		return Match{}, err
	}
	playerCount++
	if playerCount == 4 {
		if _, err := tx.Exec(ctx, `UPDATE pending_matches SET status='full' WHERE id=$1::uuid`, matchID); err != nil {
			return Match{}, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO pending_match_notices(match_id,user_id,kind) SELECT match_id,user_id,'match_completed' FROM pending_match_players WHERE match_id=$1::uuid ON CONFLICT DO NOTHING`, matchID); err != nil {
			return Match{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return Match{}, err
	}
	return r.Get(ctx, matchID, location)
}

func (r *Repository) Get(ctx context.Context, matchID string, location *time.Location) (Match, error) {
	items, err := r.listByID(ctx, matchID, location)
	if err != nil {
		return Match{}, err
	}
	if len(items) == 0 {
		return Match{}, ErrNotFound
	}
	return items[0], nil
}

func (r *Repository) listByID(ctx context.Context, matchID string, location *time.Location) ([]Match, error) {
	return r.List(ctx, ListFilters{MatchID: matchID}, time.Now(), location)
}

type Notice struct {
	ID        string    `json:"id"`
	MatchID   string    `json:"matchId"`
	Complex   string    `json:"complex"`
	StartsAt  time.Time `json:"startsAt"`
	CreatedAt time.Time `json:"createdAt"`
}

func (r *Repository) UnreadNotices(ctx context.Context, actorID string) ([]Notice, error) {
	rows, err := r.db.Query(ctx, `SELECT n.id::text,pm.id::text,cx.name,r.starts_at,n.created_at
		FROM pending_match_notices n JOIN pending_matches pm ON pm.id=n.match_id
		JOIN reservations r ON r.id=pm.reservation_id JOIN complexes cx ON cx.id=r.complex_id
		WHERE n.user_id=$1::uuid AND n.read_at IS NULL ORDER BY n.created_at DESC LIMIT 20`, actorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Notice, 0)
	for rows.Next() {
		var item Notice
		if err := rows.Scan(&item.ID, &item.MatchID, &item.Complex, &item.StartsAt, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) ReadNotice(ctx context.Context, actorID, noticeID string) error {
	command, err := r.db.Exec(ctx, `UPDATE pending_match_notices SET read_at=now() WHERE id=$1::uuid AND user_id=$2::uuid AND read_at IS NULL`, noticeID, actorID)
	if err != nil {
		return err
	}
	if command.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func clockMinutes(value string) int {
	parts := strings.Split(value, ":")
	if len(parts) != 2 || len(parts[0]) != 2 || len(parts[1]) != 2 {
		return -1
	}
	hour, hourErr := strconv.Atoi(parts[0])
	minute, minuteErr := strconv.Atoi(parts[1])
	if hourErr != nil || minuteErr != nil || hour > 23 || minute > 59 {
		return -1
	}
	return hour*60 + minute
}

func isUniqueViolation(err error) bool {
	var pgError *pgconn.PgError
	return errors.As(err, &pgError) && pgError.Code == "23505"
}
