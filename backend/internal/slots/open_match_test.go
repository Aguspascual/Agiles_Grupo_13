package slots

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/schedules"
)

func openMatchFixture(t *testing.T) (CourtData, time.Time, *time.Location) {
	t.Helper()
	location, err := time.LoadLocation(TimeZone)
	if err != nil {
		t.Fatal(err)
	}
	date := mustDate(t, "2026-11-02", location)
	court := CourtData{ID: "c41a0000-0000-4000-8000-000000000001", Name: "Cancha 1",
		Schedule: &schedules.Day{Weekday: 1, Enabled: true, DurationMinutes: 60, Intervals: []schedules.Interval{{OpensAt: "18:00", ClosesAt: "21:00"}}}}
	return court, date, location
}

func TestProjectCourtMarksSingleOpenMatchAsPending(t *testing.T) {
	court, date, location := openMatchFixture(t)
	reservations := []ReservationData{
		{CourtID: court.ID, StartsAt: date.Add(18 * time.Hour), EndsAt: date.Add(19 * time.Hour), OpenMatch: &OpenMatchInfo{Level: "5ta", Missing: 2}},
		{CourtID: court.ID, StartsAt: date.Add(19 * time.Hour), EndsAt: date.Add(20 * time.Hour)},
	}
	got, err := ProjectCourt(court, reservations, date, location, date.Add(10*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if s := got.Slots[0]; s.Status != "PENDING_MATCH" || s.PendingMatch == nil || s.PendingMatch.MissingPlayers != 2 || s.PendingMatch.Level != "5ta" {
		t.Fatalf("open match slot=%+v", s)
	}
	if s := got.Slots[1]; s.Status != "RESERVED" || s.PendingMatch != nil {
		t.Fatalf("plain reservation slot=%+v", s)
	}
	if s := got.Slots[2]; s.Status != "AVAILABLE" || s.PendingMatch != nil {
		t.Fatalf("free slot=%+v", s)
	}
	if len(got.OccupiedIntervals) != 2 {
		t.Fatalf("occupied intervals=%+v", got.OccupiedIntervals)
	}
	data, err := json.Marshal(got.Slots[1:])
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), "pendingMatch") {
		t.Fatalf("non pending slots expose pendingMatch: %s", data)
	}
}

func TestProjectCourtOpenMatchFallsBackToReserved(t *testing.T) {
	court, date, location := openMatchFixture(t)
	match := &OpenMatchInfo{Level: "5ta", Missing: 1}
	for name, test := range map[string]struct {
		reservations []ReservationData
		now          time.Time
	}{
		"overlapping reservations": {[]ReservationData{
			{CourtID: court.ID, StartsAt: date.Add(18 * time.Hour), EndsAt: date.Add(19 * time.Hour), OpenMatch: match},
			{CourtID: court.ID, StartsAt: date.Add(18*time.Hour + 30*time.Minute), EndsAt: date.Add(19 * time.Hour)},
		}, date.Add(10 * time.Hour)},
		"two open matches": {[]ReservationData{
			{CourtID: court.ID, StartsAt: date.Add(18 * time.Hour), EndsAt: date.Add(19 * time.Hour), OpenMatch: match},
			{CourtID: court.ID, StartsAt: date.Add(18 * time.Hour), EndsAt: date.Add(19 * time.Hour), OpenMatch: match},
		}, date.Add(10 * time.Hour)},
		"past slot": {[]ReservationData{
			{CourtID: court.ID, StartsAt: date.Add(18 * time.Hour), EndsAt: date.Add(19 * time.Hour), OpenMatch: match},
		}, date.Add(18 * time.Hour)},
	} {
		got, err := ProjectCourt(court, test.reservations, date, location, test.now)
		if err != nil {
			t.Fatal(err)
		}
		if s := got.Slots[0]; s.Status != "RESERVED" || s.PendingMatch != nil {
			t.Errorf("%s: slot=%+v", name, s)
		}
	}
}

func TestProjectCourtDisabledDayWithoutReservationStaysBlocked(t *testing.T) {
	court, date, location := openMatchFixture(t)
	court.Schedule.Enabled = false
	got, err := ProjectCourt(court, nil, date, location, date.Add(10*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range got.Slots {
		if s.Status != "BLOCKED" || s.PendingMatch != nil {
			t.Fatalf("slot=%+v", s)
		}
	}
}
