package schedules

import (
	"errors"
	"testing"
)

// TDD-0001 CA-03/04; TDD-0003 CA-03; RN-09/11/14.
func TestDraftValidation(t *testing.T) {
	valid := func() Draft {
		return Draft{Weekday: 1, Enabled: true, DurationMinutes: 60, Intervals: []Interval{{OpensAt: "09:00", ClosesAt: "13:00"}}}
	}
	tests := []struct {
		name    string
		change  func(*Draft)
		invalid bool
	}{
		{"valid sixty", func(d *Draft) {}, false},
		{"valid ninety", func(d *Draft) { d.DurationMinutes = 90 }, false},
		{"sunday", func(d *Draft) { d.Weekday = 7 }, false},
		{"missing weekday", func(d *Draft) { d.Weekday = 0 }, true},
		{"weekday out of range", func(d *Draft) { d.Weekday = 8 }, true},
		{"unsupported duration", func(d *Draft) { d.DurationMinutes = 30 }, true},
		{"enabled without intervals", func(d *Draft) { d.Intervals = []Interval{} }, true},
		{"disabled without intervals", func(d *Draft) { d.Enabled = false; d.Intervals = []Interval{} }, false},
		{"null intervals", func(d *Draft) { d.Enabled = false; d.Intervals = nil }, true},
		{"midnight opening", func(d *Draft) { d.Intervals = []Interval{{OpensAt: "00:00", ClosesAt: "01:00"}} }, false},
		{"last valid minute", func(d *Draft) { d.Intervals = []Interval{{OpensAt: "22:59", ClosesAt: "23:59"}} }, false},
		{"crosses midnight", func(d *Draft) { d.Intervals = []Interval{{OpensAt: "22:00", ClosesAt: "02:00"}} }, true},
		{"equal endpoints", func(d *Draft) { d.Intervals = []Interval{{OpensAt: "09:00", ClosesAt: "09:00"}} }, true},
		{"shorter than duration", func(d *Draft) { d.Intervals = []Interval{{OpensAt: "09:00", ClosesAt: "09:59"}} }, true},
		{"non divisible remainder allowed", func(d *Draft) { d.Intervals = []Interval{{OpensAt: "09:00", ClosesAt: "10:15"}} }, false},
		{"non padded hour", func(d *Draft) { d.Intervals[0].OpensAt = "9:00" }, true},
		{"seconds rejected", func(d *Draft) { d.Intervals[0].OpensAt = "09:00:00" }, true},
		{"invalid minute", func(d *Draft) { d.Intervals[0].OpensAt = "09:60" }, true},
		{"24 hour rejected", func(d *Draft) { d.Intervals[0].ClosesAt = "24:00" }, true},
		{"overlap", func(d *Draft) { d.Intervals = append(d.Intervals, Interval{OpensAt: "12:00", ClosesAt: "14:00"}) }, true},
		{"duplicate intervals", func(d *Draft) { d.Intervals = append(d.Intervals, d.Intervals[0]) }, true},
		{"contiguous intervals", func(d *Draft) { d.Intervals = append(d.Intervals, Interval{OpensAt: "13:00", ClosesAt: "14:00"}) }, false},
		{"disabled still validates", func(d *Draft) { d.Enabled = false; d.Intervals[0].ClosesAt = "02:00" }, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d := valid()
			tt.change(&d)
			err := d.Validate()
			if errors.Is(err, ErrInvalid) != tt.invalid {
				t.Fatalf("Validate()=%v, invalid=%v", err, tt.invalid)
			}
		})
	}
}

func TestDraftSortsIntervalsWithoutChangingCallerSlice(t *testing.T) {
	input := []Interval{{OpensAt: "17:00", ClosesAt: "19:00"}, {OpensAt: "09:00", ClosesAt: "13:00"}}
	d := Draft{Weekday: 1, Enabled: true, DurationMinutes: 60, Intervals: input}
	if err := d.Validate(); err != nil {
		t.Fatal(err)
	}
	if d.Intervals[0].OpensAt != "09:00" || input[0].OpensAt != "17:00" {
		t.Fatalf("draft=%+v, input=%+v", d.Intervals, input)
	}
}
