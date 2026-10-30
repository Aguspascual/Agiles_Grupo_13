package slots

import (
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/schedules"
)

func slotRange(slots []Slot) []string {
	result := make([]string, 0, len(slots))
	for _, slot := range slots {
		result = append(result, slot.StartsAt+"-"+slot.EndsAt)
	}
	return result
}

func TestProjectCourtOvernightIntervalSplitsAtMidnight(t *testing.T) {
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	monday := schedules.Day{Weekday: 1, Enabled: true, DurationMinutes: 60, Intervals: []schedules.Interval{
		{OpensAt: "08:00", ClosesAt: "10:00"}, {OpensAt: "22:00", ClosesAt: "01:00"},
	}}
	court := CourtData{ID: "c41a0000-0000-4000-8000-000000000001", Name: "Cancha 1", Schedule: &monday}
	day := mustDate(t, "2026-11-02", location) // lunes

	got, err := projectCourt(court, nil, day, location, day.Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"08:00-09:00", "09:00-10:00", "22:00-23:00", "23:00-00:00"}
	if gotRange := slotRange(got.Slots); len(gotRange) != len(want) || gotRange[0] != want[0] || gotRange[3] != want[3] {
		t.Fatalf("monday slots=%v want %v", gotRange, want)
	}

	tuesday := mustDate(t, "2026-11-03", location)
	court = CourtData{ID: court.ID, Name: court.Name, Schedule: nil, Previous: &monday}
	got, err = projectCourt(court, nil, tuesday, location, tuesday.Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if gotRange := slotRange(got.Slots); len(gotRange) != 1 || gotRange[0] != "00:00-01:00" {
		t.Fatalf("tuesday spill=%v want [00:00-01:00]", gotRange)
	}
	if got.Slots[0].ID != court.ID+":2026-11-03:00:00" {
		t.Fatalf("spill slot id=%q", got.Slots[0].ID)
	}
}

func TestProjectCourtOvernightSpillIgnoresDisabledPreviousDay(t *testing.T) {
	location, _ := time.LoadLocation("America/Argentina/Buenos_Aires")
	previous := schedules.Day{Weekday: 1, Enabled: false, DurationMinutes: 60, Intervals: []schedules.Interval{{OpensAt: "22:00", ClosesAt: "01:00"}}}
	court := CourtData{ID: "c41a0000-0000-4000-8000-000000000001", Previous: &previous}
	day := mustDate(t, "2026-11-03", location)

	got, err := projectCourt(court, nil, day, location, day.Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Slots) != 0 {
		t.Fatalf("slots=%v", slotRange(got.Slots))
	}
}