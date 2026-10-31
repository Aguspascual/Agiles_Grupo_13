package matches

import (
	"context"
	"errors"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/slotcheck"
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
		court.id::text, court.name, court.covered, court.has_lighting, r.starts_at, r.ends_at, pm.target_level, pm.extra_levels,
		u.id::text, p.name, p.level, COALESCE(p.position,''), pmp.is_organizer, COALESCE(pmp.slot,0)
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
		AND (NULLIF($4,'') IS NULL OR pm.target_level=$4 OR $4 = ANY(pm.extra_levels))
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
		var extraLevels []string
		var player Player
		if err := rows.Scan(&item.ID, &item.ReservationID, &item.Status, &item.ComplexID, &item.Complex,
			&item.Address, &item.Zone, &item.CourtID, &item.Court, &item.Covered, &item.Lighting,
			&startsAt, &endsAt, &item.TargetLevel, &extraLevels, &player.ID, &player.Name, &player.Level, &player.Position, &player.Organizer, &player.Slot); err != nil {
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
		item.TargetLevels = append([]string{item.TargetLevel}, extraLevels...)
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
	duration, offered, err := slotcheck.Duration(ctx, tx, courtID, start)
	if err != nil {
		return Match{}, err
	}
	if !offered || !start.After(now) {
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
	err = tx.QueryRow(ctx, `INSERT INTO pending_matches(reservation_id,target_level,extra_levels,status) VALUES($1::uuid,$2,$3,'open') RETURNING id::text`, result.ReservationID, input.TargetLevel, input.TargetLevels[1:]).Scan(&result.ID)
	if err != nil {
		return Match{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO pending_match_players(match_id,user_id,is_organizer,slot) VALUES($1::uuid,$2::uuid,true,NULLIF($3,0))`, result.ID, actorID, input.Slot); err != nil {
		return Match{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Match{}, err
	}
	result.Status, result.Date = "open", start.In(location).Format("2006-01-02")
	result.StartsAt, result.EndsAt = start.In(location).Format("15:04"), end.In(location).Format("15:04")
	result.TargetLevel, result.TargetLevels = input.TargetLevel, input.TargetLevels
	result.Players = []Player{{ID: actorID, Name: organizerName, Level: organizerLevel, Position: organizerPosition, Organizer: true, Slot: input.Slot}}
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
	_, err = tx.Exec(ctx, `INSERT INTO pending_match_players(match_id,user_id,slot) VALUES($1::uuid,$2::uuid,
		(SELECT s FROM generate_series(1,4) s WHERE s NOT IN (SELECT slot FROM pending_match_players WHERE match_id=$1::uuid AND slot IS NOT NULL) ORDER BY s LIMIT 1))`, matchID, actorID)
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

func (r *Repository) Leave(ctx context.Context, matchID, actorID string, now time.Time, location *time.Location) (LeaveResult, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return LeaveResult{}, err
	}
	defer tx.Rollback(ctx)

	var status string
	var startsAt time.Time
	err = tx.QueryRow(ctx, `SELECT pm.status,r.starts_at
		FROM pending_matches pm JOIN reservations r ON r.id=pm.reservation_id
		WHERE pm.id=$1::uuid AND r.status='reserved' FOR UPDATE OF pm`, matchID).Scan(&status, &startsAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return LeaveResult{}, ErrNotFound
	}
	if err != nil {
		return LeaveResult{}, err
	}

	var enrolled bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM pending_match_players WHERE match_id=$1::uuid AND user_id=$2::uuid)`, matchID, actorID).
		Scan(&enrolled); err != nil {
		return LeaveResult{}, err
	}
	if !enrolled {
		if err := tx.Commit(ctx); err != nil {
			return LeaveResult{}, err
		}
		match, err := r.getExisting(ctx, matchID, location)
		return LeaveResult{Match: &match}, err
	}
	if err := validateLeaveWindow(now, startsAt); err != nil {
		return LeaveResult{}, err
	}

	deleted, err := tx.Exec(ctx, `DELETE FROM pending_match_players WHERE match_id=$1::uuid AND user_id=$2::uuid`, matchID, actorID)
	if err != nil {
		return LeaveResult{}, err
	}
	if deleted.RowsAffected() == 0 {
		if err := tx.Commit(ctx); err != nil {
			return LeaveResult{}, err
		}
		match, err := r.getAt(ctx, matchID, now, location)
		return LeaveResult{Match: &match}, err
	}
	var remaining int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM pending_match_players WHERE match_id=$1::uuid`, matchID).Scan(&remaining); err != nil {
		return LeaveResult{}, err
	}
	if remaining == 0 {
		if _, err := tx.Exec(ctx, `UPDATE reservations SET status='cancelled'
			WHERE id=(SELECT reservation_id FROM pending_matches WHERE id=$1::uuid) AND status='reserved'`, matchID); err != nil {
			return LeaveResult{}, err
		}
		if _, err := tx.Exec(ctx, `DELETE FROM pending_matches WHERE id=$1::uuid`, matchID); err != nil {
			return LeaveResult{}, err
		}
		if err := tx.Commit(ctx); err != nil {
			return LeaveResult{}, err
		}
		return LeaveResult{Deleted: true}, nil
	}
	if status == "full" {
		if _, err := tx.Exec(ctx, `UPDATE pending_matches SET status='open' WHERE id=$1::uuid`, matchID); err != nil {
			return LeaveResult{}, err
		}
	}
	if _, err := tx.Exec(ctx, `INSERT INTO pending_match_notices(match_id,user_id,kind)
		SELECT match_id,user_id,'player_left' FROM pending_match_players
		WHERE match_id=$1::uuid AND user_id<>$2::uuid`, matchID, actorID); err != nil {
		return LeaveResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return LeaveResult{}, err
	}
	match, err := r.getAt(ctx, matchID, now, location)
	return LeaveResult{Match: &match}, err
}

func validateLeaveWindow(now, startsAt time.Time) error {
	if !startsAt.After(now) || now.After(startsAt.Add(-2*time.Hour)) {
		return ErrTooLate
	}
	return nil
}

func (r *Repository) Get(ctx context.Context, matchID string, location *time.Location) (Match, error) {
	return r.getAt(ctx, matchID, time.Now(), location)
}

func (r *Repository) getAt(ctx context.Context, matchID string, now time.Time, location *time.Location) (Match, error) {
	items, err := r.List(ctx, ListFilters{MatchID: matchID}, now, location)
	if err != nil {
		return Match{}, err
	}
	if len(items) == 0 {
		return Match{}, ErrNotFound
	}
	return items[0], nil
}

func (r *Repository) getExisting(ctx context.Context, matchID string, location *time.Location) (Match, error) {
	items, err := r.List(ctx, ListFilters{MatchID: matchID}, time.Time{}, location)
	if err != nil {
		return Match{}, err
	}
	if len(items) == 0 {
		return Match{}, ErrNotFound
	}
	return items[0], nil
}

type Notice struct {
	ID        string    `json:"id"`
	MatchID   string    `json:"matchId"`
	Kind      string    `json:"kind"`
	Complex   string    `json:"complex"`
	StartsAt  time.Time `json:"startsAt"`
	CreatedAt time.Time `json:"createdAt"`
}

func (r *Repository) UnreadNotices(ctx context.Context, actorID string) ([]Notice, error) {
	rows, err := r.db.Query(ctx, `SELECT n.id::text,pm.id::text,n.kind,cx.name,r.starts_at,n.created_at
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
		if err := rows.Scan(&item.ID, &item.MatchID, &item.Kind, &item.Complex, &item.StartsAt, &item.CreatedAt); err != nil {
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

func isUniqueViolation(err error) bool {
	var pgError *pgconn.PgError
	return errors.As(err, &pgError) && pgError.Code == "23505"
}
