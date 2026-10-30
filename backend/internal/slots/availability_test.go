package slots

import (
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/schedules"
)

func TestProjectCourtAvailabilityUsesPersistedReservationIntervals(t *testing.T) {
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	date := mustDate(t, "2026-10-30", location)
	court := CourtData{ID: "c41a0000-0000-4000-8000-000000000001", Name: "Cancha 1", Covered: true,
		Schedule: &schedules.Day{Weekday: 5, Enabled: true, DurationMinutes: 60, Intervals: []schedules.Interval{{OpensAt: "18:00", ClosesAt: "21:00"}}}}
	reservations := []ReservationData{{CourtID: court.ID, StartsAt: date.Add(18*time.Hour + 30*time.Minute), EndsAt: date.Add(20 * time.Hour)}}
	got, err := projectCourt(court, reservations, date, location, date.Add(10*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	wantStatuses := []string{"RESERVED", "RESERVED", "AVAILABLE"}
	if len(got.Slots) != len(wantStatuses) {
		t.Fatalf("slots=%+v", got.Slots)
	}
	for i, want := range wantStatuses {
		if got.Slots[i].Status != want {
			t.Errorf("slot %d status=%q want %q", i, got.Slots[i].Status, want)
		}
	}
	if len(got.OccupiedIntervals) != 1 || got.OccupiedIntervals[0].OriginalStartsAt != "2026-10-30T18:30:00-03:00" || got.OccupiedIntervals[0].OriginalEndsAt != "2026-10-30T20:00:00-03:00" {
		t.Fatalf("occupied intervals=%+v", got.OccupiedIntervals)
	}
}

func TestProjectCourtAvailabilityClipsCrossMidnightWithoutChangingOriginal(t *testing.T) {
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	start, err := time.Parse(time.RFC3339, "2026-10-30T23:30:00-03:00")
	if err != nil {
		t.Fatal(err)
	}
	end, err := time.Parse(time.RFC3339, "2026-10-31T01:00:00-03:00")
	if err != nil {
		t.Fatal(err)
	}
	court := CourtData{ID: "c41a0000-0000-4000-8000-000000000001", Name: "Cancha 1"}
	reservation := ReservationData{CourtID: court.ID, StartsAt: start, EndsAt: end}
	for _, test := range []struct{ date, visibleStart, visibleEnd string }{
		{"2026-10-30", "2026-10-30T23:30:00-03:00", "2026-10-31T00:00:00-03:00"},
		{"2026-10-31", "2026-10-31T00:00:00-03:00", "2026-10-31T01:00:00-03:00"},
	} {
		date := mustDate(t, test.date, location)
		got, err := projectCourt(court, []ReservationData{reservation}, date, location, date.Add(-time.Hour))
		if err != nil {
			t.Fatal(err)
		}
		if len(got.Slots) != 0 || len(got.OccupiedIntervals) != 1 {
			t.Fatalf("date %s produced %+v", test.date, got)
		}
		interval := got.OccupiedIntervals[0]
		if interval.OriginalStartsAt != "2026-10-30T23:30:00-03:00" || interval.OriginalEndsAt != "2026-10-31T01:00:00-03:00" || interval.VisibleStartsAt != test.visibleStart || interval.VisibleEndsAt != test.visibleEnd {
			t.Errorf("date %s interval=%+v", test.date, interval)
		}
	}
	if !reservation.StartsAt.Equal(start) || !reservation.EndsAt.Equal(end) {
		t.Fatal("projection mutated the original reservation")
	}
}

func mustDate(t *testing.T, value string, location *time.Location) time.Time {
	t.Helper()
	parsed, err := time.ParseInLocation("2006-01-02", value, location)
	if err != nil {
		t.Fatal(err)
	}
	return parsed
}
