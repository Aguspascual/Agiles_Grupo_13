package slots

import (
	"errors"
	"sort"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/schedules"
)

const TimeZone = "America/Argentina/Buenos_Aires"

var (
	ErrInvalid  = errors.New("invalid availability request")
	ErrNotFound = errors.New("complex not found")
)

type Complex struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Address string `json:"address"`
	Zone    string `json:"zone"`
}

// PendingMatch is the public summary of an open match: no names or identifiers.
type PendingMatch struct {
	MissingPlayers int    `json:"missingPlayers"`
	Level          string `json:"level"`
}

type Slot struct {
	ID           string        `json:"id"`
	StartsAt     string        `json:"startsAt"`
	EndsAt       string        `json:"endsAt"`
	Status       string        `json:"status"`
	IsPast       bool          `json:"isPast"`
	PendingMatch *PendingMatch `json:"pendingMatch,omitempty"`
}

type OccupiedInterval struct {
	OriginalStartsAt string `json:"originalStartsAt"`
	OriginalEndsAt   string `json:"originalEndsAt"`
	VisibleStartsAt  string `json:"visibleStartsAt"`
	VisibleEndsAt    string `json:"visibleEndsAt"`
}

type Court struct {
	ID                string             `json:"id"`
	Name              string             `json:"name"`
	Covered           bool               `json:"covered"`
	Slots             []Slot             `json:"slots"`
	OccupiedIntervals []OccupiedInterval `json:"occupiedIntervals"`
}

type Response struct {
	Complex Complex `json:"complex"`
	Date    string  `json:"date"`
	Courts  []Court `json:"courts"`
}

// CourtData is the read-only schedule snapshot used to produce the current grid.
type CourtData struct {
	ID       string
	Name     string
	Covered  bool
	Schedule *schedules.Day
}

// OpenMatchInfo is set only for reservations of an open match that still has free places.
type OpenMatchInfo struct {
	Level   string
	Missing int
}

// ReservationData contains only persisted occupancy timestamps, never personal data.
type ReservationData struct {
	CourtID   string
	StartsAt  time.Time
	EndsAt    time.Time
	OpenMatch *OpenMatchInfo
}

type Snapshot struct {
	Complex      Complex
	Courts       []CourtData
	Reservations []ReservationData
}

// ProjectCourt builds one court's grid for a day. It is shared with the manager agenda.
func ProjectCourt(court CourtData, reservations []ReservationData, day time.Time, location *time.Location, now time.Time) (Court, error) {
	return projectCourt(court, reservations, day, location, now)
}

func projectCourt(court CourtData, reservations []ReservationData, day time.Time, location *time.Location, now time.Time) (Court, error) {
	result := Court{ID: court.ID, Name: court.Name, Covered: court.Covered, Slots: []Slot{}, OccupiedIntervals: []OccupiedInterval{}}
	day = time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, location)
	nextDay := day.AddDate(0, 0, 1)
	if court.Schedule != nil {
		original := court.Schedule
		draft := schedules.Draft{Weekday: original.Weekday, Enabled: original.Enabled, DurationMinutes: original.DurationMinutes, Intervals: append([]schedules.Interval(nil), original.Intervals...)}
		if draft.Intervals == nil {
			draft.Intervals = []schedules.Interval{}
		}
		if err := draft.Validate(); err != nil {
			return Court{}, err
		}
		for _, interval := range draft.Intervals {
			open, okOpen := clockMinutes(interval.OpensAt)
			close, okClose := clockMinutes(interval.ClosesAt)
			if !okOpen || !okClose {
				return Court{}, schedules.ErrInvalid
			}
			for start := open; start+draft.DurationMinutes <= close; start += draft.DurationMinutes {
				starts := time.Date(day.Year(), day.Month(), day.Day(), start/60, start%60, 0, 0, location)
				endMinute := start + draft.DurationMinutes
				ends := time.Date(day.Year(), day.Month(), day.Day(), endMinute/60, endMinute%60, 0, 0, location)
				overlapping := 0
				var lastOverlap ReservationData
				for _, reservation := range reservations {
					if reservation.CourtID == court.ID && reservation.StartsAt.Before(ends) && reservation.EndsAt.After(starts) {
						overlapping++
						lastOverlap = reservation
					}
				}
				isPast := !starts.After(now)
				status := "AVAILABLE"
				var pending *PendingMatch
				if overlapping > 0 {
					status = "RESERVED"
					if overlapping == 1 && lastOverlap.OpenMatch != nil && !isPast {
						status = "PENDING_MATCH"
						pending = &PendingMatch{MissingPlayers: lastOverlap.OpenMatch.Missing, Level: lastOverlap.OpenMatch.Level}
					}
				} else if !draft.Enabled {
					status = "BLOCKED"
				}
				clockStart := starts.In(location).Format("15:04")
				clockEnd := ends.In(location).Format("15:04")
				result.Slots = append(result.Slots, Slot{ID: court.ID + ":" + day.Format("2006-01-02") + ":" + clockStart,
					StartsAt: clockStart, EndsAt: clockEnd, Status: status, IsPast: isPast, PendingMatch: pending})
			}
		}
	}
	for _, reservation := range reservations {
		if reservation.CourtID != court.ID || !reservation.StartsAt.Before(nextDay) || !reservation.EndsAt.After(day) {
			continue
		}
		visibleStart, visibleEnd := reservation.StartsAt, reservation.EndsAt
		if visibleStart.Before(day) {
			visibleStart = day
		}
		if visibleEnd.After(nextDay) {
			visibleEnd = nextDay
		}
		result.OccupiedIntervals = append(result.OccupiedIntervals, OccupiedInterval{
			OriginalStartsAt: reservation.StartsAt.In(location).Format(time.RFC3339Nano),
			OriginalEndsAt:   reservation.EndsAt.In(location).Format(time.RFC3339Nano),
			VisibleStartsAt:  visibleStart.In(location).Format(time.RFC3339Nano),
			VisibleEndsAt:    visibleEnd.In(location).Format(time.RFC3339Nano),
		})
	}
	sort.Slice(result.Slots, func(i, j int) bool { return result.Slots[i].StartsAt < result.Slots[j].StartsAt })
	sort.Slice(result.OccupiedIntervals, func(i, j int) bool {
		if result.OccupiedIntervals[i].OriginalStartsAt != result.OccupiedIntervals[j].OriginalStartsAt {
			return result.OccupiedIntervals[i].OriginalStartsAt < result.OccupiedIntervals[j].OriginalStartsAt
		}
		return result.OccupiedIntervals[i].OriginalEndsAt < result.OccupiedIntervals[j].OriginalEndsAt
	})
	return result, nil
}

func clockMinutes(value string) (int, bool) {
	if len(value) != 5 || value[2] != ':' || value[0] < '0' || value[0] > '2' || value[1] < '0' || value[1] > '9' || value[3] < '0' || value[3] > '5' || value[4] < '0' || value[4] > '9' {
		return 0, false
	}
	hour, minute := int(value[0]-'0')*10+int(value[1]-'0'), int(value[3]-'0')*10+int(value[4]-'0')
	if hour > 23 {
		return 0, false
	}
	return hour*60 + minute, true
}
