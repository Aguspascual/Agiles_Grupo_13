package schedules

import (
	"errors"
	"sort"
)

var (
	ErrInvalid                      = errors.New("invalid schedule")
	ErrForbidden                    = errors.New("forbidden schedule")
	ErrNotFound                     = errors.New("schedule not found")
	ErrConflict                     = errors.New("schedule already exists")
	ErrStaleRevision                = errors.New("stale schedule revision")
	ErrFutureReservations           = errors.New("schedule affects future reservations")
	ErrReservationSourceUnavailable = errors.New("real reservation source is unavailable")
	ErrPreconditionRequired         = errors.New("schedule revision is required")
)

type Interval struct {
	ID       string `json:"id"`
	OpensAt  string `json:"opensAt"`
	ClosesAt string `json:"closesAt"`
}

type Day struct {
	Weekday         int        `json:"weekday"`
	Enabled         bool       `json:"enabled"`
	DurationMinutes int        `json:"durationMinutes"`
	Revision        string     `json:"revision"`
	Intervals       []Interval `json:"intervals"`
}

type Draft struct {
	Weekday         int
	Enabled         bool
	DurationMinutes int
	Intervals       []Interval
}

func (d *Draft) Validate() error {
	if d.Weekday < 1 || d.Weekday > 7 || (d.DurationMinutes != 60 && d.DurationMinutes != 90) ||
		d.Intervals == nil || (d.Enabled && len(d.Intervals) == 0) {
		return ErrInvalid
	}
	intervals := make([]Interval, len(d.Intervals))
	copy(intervals, d.Intervals)
	sort.Slice(intervals, func(i, j int) bool { return intervals[i].OpensAt < intervals[j].OpensAt })
	previousEnd := -1
	for _, interval := range intervals {
		start, end := minutes(interval.OpensAt), minutes(interval.ClosesAt)
		if start < 0 || end < 0 || end-start < d.DurationMinutes || start < previousEnd {
			return ErrInvalid
		}
		previousEnd = end
	}
	d.Intervals = intervals
	return nil
}

func minutes(value string) int {
	if len(value) != 5 || value[2] != ':' {
		return -1
	}
	for _, index := range []int{0, 1, 3, 4} {
		if value[index] < '0' || value[index] > '9' {
			return -1
		}
	}
	hour := int(value[0]-'0')*10 + int(value[1]-'0')
	minute := int(value[3]-'0')*10 + int(value[4]-'0')
	if hour > 23 || minute > 59 {
		return -1
	}
	return hour*60 + minute
}
