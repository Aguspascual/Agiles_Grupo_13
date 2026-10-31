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
	// ImageURL is only filled in the public directory, and only when the complex has a picture.
	ImageURL string `json:"imageUrl,omitempty"`
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
	ID      string
	Name    string
	Covered bool
	// Schedule is the schedule of the requested weekday; Previous is the one of the day before, whose overnight
	// intervals continue into the first hours of the requested day.
	Schedule *schedules.Day
	Previous *schedules.Day
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
	// The previous day's overnight intervals continue into the first hours of this day.
	sources := []struct {
		day   *schedules.Day
		shift int
	}{{court.Schedule, 0}, {court.Previous, 24 * 60}}
	for _, source := range sources {
		if source.day == nil || (source.shift > 0 && !source.day.Enabled) {
			continue
		}
		original := source.day
		draft := schedules.Draft{Weekday: original.Weekday, Enabled: original.Enabled, DurationMinutes: original.DurationMinutes, Intervals: append([]schedules.Interval(nil), original.Intervals...)}
		if draft.Intervals == nil {
			draft.Intervals = []schedules.Interval{}
		}
		if err := draft.Validate(); err != nil {
			return Court{}, err
		}
		for _, interval := range draft.Intervals {
			open, closing, ok := interval.Range()
			if !ok {
				return Court{}, schedules.ErrInvalid
			}
			for start := open; start+draft.DurationMinutes <= closing; start += draft.DurationMinutes {
				minute := start - source.shift
				if minute < 0 {
					continue
				}
				if minute >= 24*60 {
					break
				}
				starts := time.Date(day.Year(), day.Month(), day.Day(), minute/60, minute%60, 0, 0, location)
				endMinute := minute + draft.DurationMinutes
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
