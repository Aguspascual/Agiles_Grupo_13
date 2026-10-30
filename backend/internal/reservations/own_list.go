package reservations

import (
	"context"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

// MyPath lists the authenticated player's reservations and matches (TDD-0013, HU-17).
const MyPath = "/api/v1/me/reservations"

const (
	ViewUpcoming = "upcoming"
	ViewPast     = "past"

	defaultOwnLimit = 20
	maxOwnLimit     = 100
)

type ownListQuery struct {
	view          string
	limit, offset int
}

// OwnMatch is only present for kind=match.
type OwnMatch struct {
	Status         string `json:"status"`
	TargetLevel    string `json:"targetLevel"`
	MissingPlayers int    `json:"missingPlayers"`
}

// OwnItem is one reservation or match of the player; it never carries contact data or other players.
type OwnItem struct {
	Kind          string        `json:"kind"`
	ID            string        `json:"id"`
	ReservationID string        `json:"reservationId"`
	Status        string        `json:"status"`
	Complex       NamedResource `json:"complex"`
	Court         NamedResource `json:"court"`
	StartsAt      string        `json:"startsAt"`
	EndsAt        string        `json:"endsAt"`
	TimeZone      string        `json:"timeZone"`
	Role          string        `json:"role"`
	Cancellable   bool          `json:"cancellable"`
	Match         *OwnMatch     `json:"match,omitempty"`
}

// OwnPage is the pagination block of the response.
type OwnPage struct {
	Limit   int  `json:"limit"`
	Offset  int  `json:"offset"`
	HasMore bool `json:"hasMore"`
}

func parseOwnList(query url.Values) (ownListQuery, error) {
	parsed := ownListQuery{limit: defaultOwnLimit}
	for key, values := range query {
		if len(values) != 1 || values[0] == "" {
			return ownListQuery{}, ErrInvalid
		}
		switch key {
		case "view":
			if values[0] != ViewUpcoming && values[0] != ViewPast {
				return ownListQuery{}, ErrInvalid
			}
			parsed.view = values[0]
		case "limit":
			n, ok := parseDigits(values[0])
			if !ok || n < 1 || n > maxOwnLimit {
				return ownListQuery{}, ErrInvalid
			}
			parsed.limit = n
		case "offset":
			n, ok := parseDigits(values[0])
			if !ok {
				return ownListQuery{}, ErrInvalid
			}
			parsed.offset = n
		default:
			return ownListQuery{}, ErrInvalid
		}
	}
	if parsed.view == "" {
		return ownListQuery{}, ErrInvalid
	}
	return parsed, nil
}

// parseDigits accepts only plain decimal digits: no sign, spaces or overflow.
func parseDigits(value string) (int, bool) {
	for _, c := range value {
		if c < '0' || c > '9' {
			return 0, false
		}
	}
	n, err := strconv.Atoi(value)
	return n, err == nil
}

func (s *Service) listMine(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	actor, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		auth.WriteError(w, http.StatusUnauthorized, "no autorizado")
		return
	}
	values, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		auth.WriteError(w, http.StatusBadRequest, "solicitud inválida")
		return
	}
	query, err := parseOwnList(values)
	if err != nil {
		auth.WriteError(w, http.StatusBadRequest, "solicitud inválida")
		return
	}
	items, page, err := s.repository.ListMine(r.Context(), actor, query, s.location)
	if err != nil {
		auth.WriteError(w, http.StatusInternalServerError, "no se pudieron consultar las reservas")
		return
	}
	auth.WriteJSON(w, http.StatusOK, map[string]any{"items": items, "page": page})
}

const ownListSelect = `SELECT kind, id, reservation_id, status, complex_id, complex_name, court_id, court_name,
		starts_at, ends_at, role, match_status, target_level, players
	FROM (
		SELECT 'reservation'::text AS kind, r.id::text AS id, r.id::text AS reservation_id, r.status,
			c.id::text AS complex_id, c.name AS complex_name, court.id::text AS court_id, court.name AS court_name,
			r.starts_at, r.ends_at, 'organizer'::text AS role,
			NULL::text AS match_status, NULL::text AS target_level, NULL::int AS players
		FROM reservations r
		JOIN complexes c ON c.id = r.complex_id
		JOIN courts court ON court.id = r.court_id
		WHERE r.origin = 'web' AND r.organizer_id = $1::uuid
		UNION ALL
		SELECT 'match'::text, m.id::text, r.id::text, r.status,
			c.id::text, c.name, court.id::text, court.name,
			r.starts_at, r.ends_at,
			CASE WHEN me.is_organizer THEN 'organizer' ELSE 'player' END,
			m.status, m.target_level,
			(SELECT count(*)::int FROM pending_match_players p WHERE p.match_id = m.id)
		FROM pending_match_players me
		JOIN pending_matches m ON m.id = me.match_id
		JOIN reservations r ON r.id = m.reservation_id
		JOIN complexes c ON c.id = r.complex_id
		JOIN courts court ON court.id = r.court_id
		WHERE me.user_id = $1::uuid
	) items
	WHERE `

const (
	ownUpcomingSQL = ownListSelect + `ends_at > $2::timestamptz ORDER BY starts_at, id LIMIT $3 OFFSET $4`
	ownPastSQL     = ownListSelect + `ends_at <= $2::timestamptz ORDER BY starts_at DESC, id DESC LIMIT $3 OFFSET $4`
)

// ListMine returns the player's web reservations and joined matches for one view, using a single server instant.
func (r *Repository) ListMine(ctx context.Context, actorID string, query ownListQuery, location *time.Location) ([]OwnItem, OwnPage, error) {
	statement := ownUpcomingSQL
	if query.view == ViewPast {
		statement = ownPastSQL
	}
	now := r.now()
	rows, err := r.db.Query(ctx, statement, actorID, now, query.limit+1, query.offset)
	if err != nil {
		return nil, OwnPage{}, err
	}
	defer rows.Close()
	items := make([]OwnItem, 0, query.limit+1)
	for rows.Next() {
		var item OwnItem
		var startsAt, endsAt time.Time
		var matchStatus, level *string
		var players *int
		if err := rows.Scan(&item.Kind, &item.ID, &item.ReservationID, &item.Status, &item.Complex.ID, &item.Complex.Name,
			&item.Court.ID, &item.Court.Name, &startsAt, &endsAt, &item.Role, &matchStatus, &level, &players); err != nil {
			return nil, OwnPage{}, err
		}
		item.StartsAt = startsAt.In(location).Format(time.RFC3339)
		item.EndsAt = endsAt.In(location).Format(time.RFC3339)
		item.TimeZone = location.String()
		if item.Kind == "match" && matchStatus != nil && level != nil && players != nil {
			item.Match = &OwnMatch{Status: *matchStatus, TargetLevel: *level, MissingPlayers: max(0, 4-*players)}
		}
		item.Cancellable = ownCancellable(item.Kind, item.Status, now, startsAt)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, OwnPage{}, err
	}
	page := OwnPage{Limit: query.limit, Offset: query.offset, HasMore: len(items) > query.limit}
	if page.HasMore {
		items = items[:query.limit]
	}
	return items, page, nil
}

// ownCancellable reuses the player cancellation rule (RN-02); matches are never cancellable here.
func ownCancellable(kind, status string, now, startsAt time.Time) bool {
	return kind == "reservation" && status == "reserved" && playerMayCancel(now, startsAt)
}
