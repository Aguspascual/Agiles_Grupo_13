package reservations

import (
	"testing"
	"time"
)

func TestPlayerCancellationWindowIsInclusive(t *testing.T) {
	start := time.Date(2026, 11, 3, 18, 0, 0, 0, time.FixedZone("BA", -3*3600))
	limit := start.Add(-4 * time.Hour)
	for _, tc := range []struct {
		name string
		now  time.Time
		want bool
	}{
		{"well before", limit.Add(-time.Hour), true},
		{"one nanosecond before", limit.Add(-time.Nanosecond), true},
		{"exact limit", limit, true},
		{"one nanosecond after", limit.Add(time.Nanosecond), false},
		{"after start", start.Add(time.Minute), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := playerMayCancel(tc.now, start); got != tc.want {
				t.Fatalf("playerMayCancel(%v)=%v want %v", tc.now, got, tc.want)
			}
		})
	}
}

func TestManagerMayCancelUntilReservationEnds(t *testing.T) {
	end := time.Date(2026, 11, 3, 19, 30, 0, 0, time.UTC)
	for _, tc := range []struct {
		name string
		now  time.Time
		want bool
	}{
		{"future", end.Add(-72 * time.Hour), true},
		{"in progress", end.Add(-time.Minute), true},
		{"one nanosecond before end", end.Add(-time.Nanosecond), true},
		{"exact end", end, false},
		{"finished", end.Add(time.Hour), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := managerMayCancel(tc.now, end); got != tc.want {
				t.Fatalf("managerMayCancel(%v)=%v want %v", tc.now, got, tc.want)
			}
		})
	}
}
