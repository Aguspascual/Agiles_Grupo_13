package agenda

import (
	"errors"
	"sort"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/slots"
)

var (
	ErrInvalid   = errors.New("invalid agenda request")
	ErrNotFound  = errors.New("complex not found")
	ErrForbidden = errors.New("agenda forbidden")
)

type Contact struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
}

type Slot struct {
	ID            string `json:"id"`
	StartsAt      string `json:"startsAt"`
	EndsAt        string `json:"endsAt"`
	Status        string `json:"status"`
	IsPast        bool   `json:"isPast"`
	ReservationID string `json:"reservationId,omitempty"`
}

// MatchPlayer is a player signed up to an open match; it carries no user id or contact data.
type MatchPlayer struct {
	Name      string `json:"name"`
	Level     string `json:"level"`
	Position  string `json:"position,omitempty"`
	Organizer bool   `json:"organizer"`
}

type PendingMatch struct {
	ID             string        `json:"id"`
	Status         string        `json:"status"`
	TargetLevel    string        `json:"targetLevel"`
	MissingPlayers int           `json:"missingPlayers"`
	Players        []MatchPlayer `json:"players"`
}

type Reservation struct {
	ID               string        `json:"id"`
	Origin           string        `json:"origin"`
	StartsAt         string        `json:"startsAt"`
	EndsAt           string        `json:"endsAt"`
	OriginalStartsAt string        `json:"originalStartsAt"`
	OriginalEndsAt   string        `json:"originalEndsAt"`
	Contact          Contact       `json:"contact"`
	Cancellable      bool          `json:"cancellable"`
	PendingMatch     *PendingMatch `json:"pendingMatch,omitempty"`
}

type Court struct {
	ID           string        `json:"id"`
	Name         string        `json:"name"`
	Covered      bool          `json:"covered"`
	Slots        []Slot        `json:"slots"`
	Reservations []Reservation `json:"reservations"`
}

type Response struct {
	Complex slots.Complex `json:"complex"`
	Date    string        `json:"date"`
	Courts  []Court       `json:"courts"`
}

// ReservationData is a persisted live reservation with its contact.
type ReservationData struct {
	ID       string
	CourtID  string
	Origin   string
	Contact  Contact
	StartsAt time.Time
	EndsAt   time.Time
	// PendingMatch is set only for origin 'open_match' reservations that have a match row.
	PendingMatch *PendingMatch
}

type Snapshot struct {
	Complex      slots.Complex
	Courts       []slots.CourtData
	Reservations []ReservationData
}

func build(snapshot Snapshot, dayStart time.Time, location *time.Location, now time.Time) (Response, error) {
	occupancy := make([]slots.ReservationData, 0, len(snapshot.Reservations))
	for _, r := range snapshot.Reservations {
		occupancy = append(occupancy, slots.ReservationData{CourtID: r.CourtID, StartsAt: r.StartsAt, EndsAt: r.EndsAt})
	}
	courts := make([]Court, 0, len(snapshot.Courts))
	for _, data := range snapshot.Courts {
		projected, err := slots.ProjectCourt(data, occupancy, dayStart, location, now)
		if err != nil {
			return Response{}, err
		}
		court := Court{ID: projected.ID, Name: projected.Name, Covered: projected.Covered, Slots: []Slot{}, Reservations: []Reservation{}}
		var own []ReservationData
		for _, r := range snapshot.Reservations {
			if r.CourtID == data.ID {
				own = append(own, r)
			}
		}
		for _, s := range projected.Slots {
			item := Slot{ID: s.ID, StartsAt: s.StartsAt, EndsAt: s.EndsAt, Status: s.Status, IsPast: s.IsPast}
			if s.Status == "RESERVED" {
				start, end := clock(dayStart, s.StartsAt, location), clock(dayStart, s.EndsAt, location)
				for _, r := range own {
					if r.StartsAt.Before(end) && r.EndsAt.After(start) {
						item.ReservationID = r.ID
						break
					}
				}
			}
			court.Slots = append(court.Slots, item)
		}
		for _, r := range own {
			item := Reservation{
				ID: r.ID, Origin: r.Origin,
				StartsAt: r.StartsAt.In(location).Format("15:04"), EndsAt: r.EndsAt.In(location).Format("15:04"),
				OriginalStartsAt: r.StartsAt.In(location).Format(time.RFC3339), OriginalEndsAt: r.EndsAt.In(location).Format(time.RFC3339),
				Contact: r.Contact, Cancellable: r.EndsAt.After(now),
			}
			if r.Origin == "open_match" {
				item.PendingMatch = r.PendingMatch
			}
			court.Reservations = append(court.Reservations, item)
		}
		courts = append(courts, court)
	}
	sort.Slice(courts, func(i, j int) bool {
		if courts[i].Name != courts[j].Name {
			return courts[i].Name < courts[j].Name
		}
		return courts[i].ID < courts[j].ID
	})
	return Response{Complex: snapshot.Complex, Date: dayStart.Format("2006-01-02"), Courts: courts}, nil
}

func clock(day time.Time, hhmm string, location *time.Location) time.Time {
	var h, m int
	for i, v := range []*int{&h, &m} {
		*v = int(hhmm[i*3]-'0')*10 + int(hhmm[i*3+1]-'0')
	}
	return time.Date(day.Year(), day.Month(), day.Day(), h, m, 0, 0, location)
}
