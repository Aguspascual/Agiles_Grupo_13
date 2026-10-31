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

const minutesPerDay = 24 * 60

// Range returns the interval in minutes since the opening day started. A closing time earlier than
// the opening one means the interval crosses midnight: its end is counted on the following day, so it
// is greater than 1440. Equal endpoints are not a valid interval.
func (i Interval) Range() (start, end int, ok bool) {
	start, end = minutes(i.OpensAt), minutes(i.ClosesAt)
	if start < 0 || end < 0 || start == end {
		return 0, 0, false
	}
	if end < start {
		end += minutesPerDay
	}
	return start, end, true
}

// SpillEnd is the minute of the following day at which the overnight intervals stop (0 when none).
func SpillEnd(intervals []Interval) int {
	spill := 0
	for _, interval := range intervals {
		if _, end, ok := interval.Range(); ok && end-minutesPerDay > spill {
			spill = end - minutesPerDay
		}
	}
	return spill
}

// FirstOpening is the earliest opening minute of a day (a full day when there are no intervals).
func FirstOpening(intervals []Interval) int {
	first := minutesPerDay
	for _, interval := range intervals {
		if start, _, ok := interval.Range(); ok && start < first {
			first = start
		}
	}
	return first
}

// ConflictsWithAdjacentDays reports whether the draft overlaps the overnight spill of the previous
// day or its own spill overlaps the opening hours of the next day.
func ConflictsWithAdjacentDays(draft Draft, previous, next *Day) bool {
	if previous != nil && FirstOpening(draft.Intervals) < SpillEnd(previous.Intervals) {
		return true
	}
	return next != nil && SpillEnd(draft.Intervals) > FirstOpening(next.Intervals)
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
		start, end, ok := interval.Range()
		if !ok || end-start < d.DurationMinutes || start < previousEnd {
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
