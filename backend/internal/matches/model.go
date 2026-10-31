package matches

import (
	"errors"
	"net/url"
	"strings"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

var (
	ErrInvalid   = errors.New("invalid match")
	ErrNotFound  = errors.New("match not found")
	ErrConflict  = errors.New("match conflict")
	ErrDuplicate = errors.New("player already joined")
	ErrTooLate   = errors.New("the match leave window has closed")
)

const (
	ListPath    = "/api/v1/matches"
	CreatePath  = "/api/v1/complexes/{complexId}/courts/{courtId}/matches"
	JoinPath    = "/api/v1/matches/{matchId}/players"
	LeavePath   = "/api/v1/matches/{matchId}/players/me"
	NoticesPath = "/api/v1/match-notices"
	OptionsPath = "/api/v1/matches/options"
)

var validLevels = map[string]bool{
	"Principiante": true, "8va": true, "7ma": true, "6ta": true,
	"5ta": true, "4ta": true, "3ra": true, "2da": true, "1ra": true,
}

type Player struct {
	ID        string `json:"-"`
	Name      string `json:"name"`
	Level     string `json:"level"`
	Position  string `json:"position,omitempty"`
	Organizer bool   `json:"organizer"`
}

type Match struct {
	ID            string   `json:"id"`
	ReservationID string   `json:"-"`
	Status        string   `json:"status"`
	ComplexID     string   `json:"complexId"`
	Complex       string   `json:"complex"`
	Address       string   `json:"address"`
	Zone          string   `json:"zone"`
	CourtID       string   `json:"courtId"`
	Court         string   `json:"court"`
	Covered       bool     `json:"covered"`
	Lighting      bool     `json:"lighting"`
	Date          string   `json:"date"`
	StartsAt      string   `json:"startsAt"`
	EndsAt        string   `json:"endsAt"`
	TargetLevel   string   `json:"targetLevel"`
	Players       []Player `json:"players"`
	Missing       int      `json:"missingPlayers"`
}

type LeaveResult struct {
	Match   *Match
	Deleted bool
}

type CourtOption struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Covered  bool   `json:"covered"`
	Lighting bool   `json:"lighting"`
}

type ComplexOption struct {
	ID      string        `json:"id"`
	Name    string        `json:"name"`
	Address string        `json:"address"`
	Zone    string        `json:"zone"`
	Courts  []CourtOption `json:"courts"`
}

type CreateRequest struct {
	Date        string `json:"date"`
	StartsAt    string `json:"startsAt"`
	TargetLevel string `json:"targetLevel"`
}

type ListFilters struct {
	Date      *time.Time
	ComplexID string
	Level     string
	MatchID   string
	OnlyOpen  bool
}

func ParseFilters(query url.Values, location *time.Location) (ListFilters, error) {
	for key, values := range query {
		if (key != "date" && key != "complexId" && key != "level") || len(values) != 1 {
			return ListFilters{}, ErrInvalid
		}
	}
	filters := ListFilters{ComplexID: strings.TrimSpace(query.Get("complexId")), Level: strings.TrimSpace(query.Get("level"))}
	if raw := query.Get("date"); raw != "" {
		date, err := time.ParseInLocation("2006-01-02", raw, location)
		if err != nil || date.Format("2006-01-02") != raw {
			return ListFilters{}, ErrInvalid
		}
		filters.Date = &date
	}
	if filters.ComplexID != "" && !auth.ValidUUID(filters.ComplexID) {
		return ListFilters{}, ErrInvalid
	}
	if filters.Level != "" && !validLevels[filters.Level] {
		return ListFilters{}, ErrInvalid
	}
	return filters, nil
}

func (r *CreateRequest) Validate(now time.Time, location *time.Location) (time.Time, error) {
	r.Date = strings.TrimSpace(r.Date)
	r.StartsAt = strings.TrimSpace(r.StartsAt)
	r.TargetLevel = strings.TrimSpace(r.TargetLevel)
	if !validLevels[r.TargetLevel] || len(r.Date) != 10 || len(r.StartsAt) != 5 {
		return time.Time{}, ErrInvalid
	}
	start, err := time.ParseInLocation("2006-01-02 15:04", r.Date+" "+r.StartsAt, location)
	if err != nil || start.Format("2006-01-02 15:04") != r.Date+" "+r.StartsAt || !start.After(now) {
		return time.Time{}, ErrInvalid
	}
	return start, nil
}
