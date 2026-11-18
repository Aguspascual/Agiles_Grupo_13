package matches

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

const AbsenceReportsPath = "/api/v1/matches/{matchId}/absence-reports"

var (
	ErrNotParticipant   = errors.New("not a match participant")
	ErrAbsenceWindow    = errors.New("absence reporting window closed")
	ErrAbsenceDuplicate = errors.New("absence report already submitted")
)

type AbsencePlayer struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	IsSelf       bool   `json:"isSelf"`
	ReportCount  int    `json:"reportCount"`
	Confirmed    bool   `json:"confirmed"`
	ReportedByMe bool   `json:"reportedByMe"`
	CanReport    bool   `json:"canReport"`
}

type AbsenceState struct {
	MatchID    string          `json:"matchId"`
	EndsAt     time.Time       `json:"endsAt"`
	Deadline   time.Time       `json:"deadline"`
	ServerNow  time.Time       `json:"serverNow"`
	WindowOpen bool            `json:"windowOpen"`
	Players    []AbsencePlayer `json:"players"`
}

func (r *Repository) GetAbsences(ctx context.Context, matchID, actorID string, now time.Time) (AbsenceState, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return AbsenceState{}, err
	}
	defer tx.Rollback(ctx)
	var state AbsenceState
	var reservationID string
	err = tx.QueryRow(ctx, `SELECT reservation_id::text FROM pending_matches WHERE id=$1::uuid`, matchID).Scan(&reservationID)
	if errors.Is(err, pgx.ErrNoRows) {
		return AbsenceState{}, ErrNotFound
	}
	if err != nil {
		return AbsenceState{}, err
	}
	var reservationStatus, matchStatus string
	if err := tx.QueryRow(ctx, `SELECT ends_at,status FROM reservations WHERE id=$1::uuid FOR SHARE`, reservationID).Scan(&state.EndsAt, &reservationStatus); errors.Is(err, pgx.ErrNoRows) {
		return AbsenceState{}, ErrNotFound
	} else if err != nil {
		return AbsenceState{}, err
	}
	err = tx.QueryRow(ctx, `SELECT status FROM pending_matches WHERE id=$1::uuid AND reservation_id=$2::uuid FOR SHARE`, matchID, reservationID).Scan(&matchStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return AbsenceState{}, ErrNotFound
	}
	if err != nil {
		return AbsenceState{}, err
	}
	if reservationStatus != "reserved" || matchStatus == "cancelled" {
		return AbsenceState{}, ErrNotFound
	}
	state.MatchID = matchID
	if err := participant(ctx, tx, matchID, actorID); err != nil {
		return AbsenceState{}, err
	}
	state.ServerNow = now
	state.EndsAt = state.EndsAt.In(time.FixedZone("-03", -3*60*60))
	state.Deadline = state.EndsAt.Add(48 * time.Hour)
	state.WindowOpen = !now.Before(state.EndsAt) && !now.After(state.Deadline)
	rows, err := tx.Query(ctx, `SELECT pmp.user_id::text,p.name, count(ar.reporter_user_id)::int, COALESCE(bool_or(ar.reporter_user_id=$2::uuid),false) FROM pending_match_players pmp JOIN player_profiles p ON p.user_id=pmp.user_id LEFT JOIN match_absence_reports ar ON ar.match_id=pmp.match_id AND ar.reported_user_id=pmp.user_id WHERE pmp.match_id=$1::uuid GROUP BY pmp.user_id,p.name,pmp.joined_at ORDER BY pmp.joined_at,pmp.user_id`, matchID, actorID)
	if err != nil {
		return AbsenceState{}, err
	}
	defer rows.Close()
	state.Players = make([]AbsencePlayer, 0, 4)
	for rows.Next() {
		var p AbsencePlayer
		if err := rows.Scan(&p.ID, &p.Name, &p.ReportCount, &p.ReportedByMe); err != nil {
			return AbsenceState{}, err
		}
		p.IsSelf = p.ID == actorID
		p.Confirmed = p.ReportCount >= 2
		p.CanReport = state.WindowOpen && !p.IsSelf && !p.ReportedByMe
		state.Players = append(state.Players, p)
	}
	if err := rows.Err(); err != nil {
		return AbsenceState{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return AbsenceState{}, err
	}
	return state, nil
}

func participant(ctx context.Context, tx pgx.Tx, matchID, userID string) error {
	var yes bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM pending_match_players WHERE match_id=$1::uuid AND user_id=$2::uuid)`, matchID, userID).Scan(&yes); err != nil {
		return err
	}
	if !yes {
		return ErrNotParticipant
	}
	return nil
}

func (r *Repository) ReportAbsence(ctx context.Context, matchID, actorID, playerID string, clock func() time.Time, location *time.Location) (AbsenceState, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return AbsenceState{}, err
	}
	defer tx.Rollback(ctx)
	var reservationID string
	err = tx.QueryRow(ctx, `SELECT reservation_id::text FROM pending_matches WHERE id=$1::uuid`, matchID).Scan(&reservationID)
	if errors.Is(err, pgx.ErrNoRows) {
		return AbsenceState{}, ErrNotFound
	}
	if err != nil {
		return AbsenceState{}, err
	}
	var ends time.Time
	var reservationStatus, matchStatus string
	if err := tx.QueryRow(ctx, `SELECT ends_at,status FROM reservations WHERE id=$1::uuid FOR UPDATE`, reservationID).Scan(&ends, &reservationStatus); errors.Is(err, pgx.ErrNoRows) {
		return AbsenceState{}, ErrNotFound
	} else if err != nil {
		return AbsenceState{}, err
	}
	err = tx.QueryRow(ctx, `SELECT status FROM pending_matches WHERE id=$1::uuid AND reservation_id=$2::uuid FOR UPDATE`, matchID, reservationID).Scan(&matchStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return AbsenceState{}, ErrNotFound
	}
	if err != nil {
		return AbsenceState{}, err
	}
	if reservationStatus != "reserved" || matchStatus == "cancelled" {
		return AbsenceState{}, ErrNotFound
	}
	if err := participant(ctx, tx, matchID, actorID); err != nil {
		return AbsenceState{}, err
	}
	if playerID == actorID {
		return AbsenceState{}, ErrInvalid
	}
	if err := participant(ctx, tx, matchID, playerID); err != nil {
		return AbsenceState{}, ErrInvalid
	}
	now := clock()
	if now.Before(ends) || now.After(ends.Add(48*time.Hour)) {
		return AbsenceState{}, ErrAbsenceWindow
	}
	_, err = tx.Exec(ctx, `INSERT INTO match_absence_reports(match_id,reported_user_id,reporter_user_id,created_at) VALUES($1::uuid,$2::uuid,$3::uuid,$4)`, matchID, playerID, actorID, now)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return AbsenceState{}, ErrAbsenceDuplicate
		}
		return AbsenceState{}, err
	}
	state, err := getAbsencesTx(ctx, tx, matchID, actorID, now, location)
	if err != nil {
		return AbsenceState{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return AbsenceState{}, err
	}
	return state, nil
}

func getAbsencesTx(ctx context.Context, tx pgx.Tx, matchID, actorID string, now time.Time, location *time.Location) (AbsenceState, error) {
	var state AbsenceState
	var status, matchStatus string
	err := tx.QueryRow(ctx, `SELECT pm.id::text,r.ends_at,r.status,pm.status FROM pending_matches pm JOIN reservations r ON r.id=pm.reservation_id WHERE pm.id=$1::uuid`, matchID).Scan(&state.MatchID, &state.EndsAt, &status, &matchStatus)
	if err != nil {
		return state, err
	}
	if status != "reserved" || matchStatus == "cancelled" {
		return state, ErrNotFound
	}
	state.ServerNow = now
	state.EndsAt = state.EndsAt.In(location)
	state.Deadline = state.EndsAt.Add(48 * time.Hour)
	state.WindowOpen = !now.Before(state.EndsAt) && !now.After(state.Deadline)
	rows, err := tx.Query(ctx, `SELECT pmp.user_id::text,p.name,count(ar.reporter_user_id)::int,COALESCE(bool_or(ar.reporter_user_id=$2::uuid),false) FROM pending_match_players pmp JOIN player_profiles p ON p.user_id=pmp.user_id LEFT JOIN match_absence_reports ar ON ar.match_id=pmp.match_id AND ar.reported_user_id=pmp.user_id WHERE pmp.match_id=$1::uuid GROUP BY pmp.user_id,p.name,pmp.joined_at ORDER BY pmp.joined_at,pmp.user_id`, matchID, actorID)
	if err != nil {
		return state, err
	}
	defer rows.Close()
	state.Players = make([]AbsencePlayer, 0, 4)
	for rows.Next() {
		var p AbsencePlayer
		if err := rows.Scan(&p.ID, &p.Name, &p.ReportCount, &p.ReportedByMe); err != nil {
			return state, err
		}
		p.IsSelf = p.ID == actorID
		p.Confirmed = p.ReportCount >= 2
		p.CanReport = state.WindowOpen && !p.IsSelf && !p.ReportedByMe
		state.Players = append(state.Players, p)
	}
	return state, rows.Err()
}

func (s *Service) absenceRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET "+AbsenceReportsPath, s.getAbsences)
	mux.HandleFunc("POST "+AbsenceReportsPath, s.reportAbsence)
}
func (s *Service) getAbsences(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	actor, ok := auth.UserIDFromContext(r.Context())
	id := r.PathValue("matchId")
	if !ok {
		auth.WriteError(w, 401, "no autorizado")
		return
	}
	if !auth.ValidUUID(id) || r.URL.RawQuery != "" || requestHasBody(r) {
		auth.WriteError(w, 400, "solicitud inválida")
		return
	}
	state, err := s.repository.GetAbsences(r.Context(), id, actor, s.clock())
	if err != nil {
		s.writeAbsenceError(w, err)
		return
	}
	auth.WriteJSON(w, 200, state)
}
func (s *Service) reportAbsence(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	actor, ok := auth.UserIDFromContext(r.Context())
	id := r.PathValue("matchId")
	if !ok {
		auth.WriteError(w, 401, "no autorizado")
		return
	}
	if !auth.ValidUUID(id) || r.URL.RawQuery != "" {
		auth.WriteError(w, 400, "solicitud inválida")
		return
	}
	var input struct {
		PlayerID string `json:"playerId"`
	}
	if !auth.DecodeJSON(w, r, &input) {
		return
	}
	if !auth.ValidUUID(input.PlayerID) {
		auth.WriteError(w, 400, "solicitud inválida")
		return
	}
	state, err := s.repository.ReportAbsence(r.Context(), id, actor, input.PlayerID, s.clock, s.location)
	if err != nil {
		s.writeAbsenceError(w, err)
		return
	}
	auth.WriteJSON(w, 201, state)
}
func (s *Service) writeAbsenceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrInvalid):
		auth.WriteError(w, 400, "solicitud inválida")
	case errors.Is(err, ErrAbsenceDuplicate):
		auth.WriteError(w, 409, "ya reportaste a este jugador")
	case errors.Is(err, ErrAbsenceWindow):
		auth.WriteError(w, 409, "el plazo para reportar no está abierto")
	case errors.Is(err, ErrNotParticipant):
		auth.WriteError(w, 403, "no participás de este partido")
	case errors.Is(err, ErrNotFound):
		auth.WriteError(w, 404, "partido no encontrado")
	default:
		auth.WriteError(w, 500, "no se pudo procesar el reporte")
	}
}

var _ context.Context
