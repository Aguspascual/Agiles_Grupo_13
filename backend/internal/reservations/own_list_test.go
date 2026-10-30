package reservations

import (
	"net/url"
	"testing"
	"time"
)

func TestParseOwnList(t *testing.T) {
	valid := []struct {
		raw  string
		want ownListQuery
	}{
		{"view=upcoming", ownListQuery{view: ViewUpcoming, limit: 20}},
		{"view=past&limit=1&offset=0", ownListQuery{view: ViewPast, limit: 1}},
		{"view=past&limit=100&offset=40", ownListQuery{view: ViewPast, limit: 100, offset: 40}},
	}
	for _, tc := range valid {
		values, _ := url.ParseQuery(tc.raw)
		got, err := parseOwnList(values)
		if err != nil || got != tc.want {
			t.Fatalf("%q => %+v, %v; want %+v", tc.raw, got, err, tc.want)
		}
	}
	invalid := []string{
		"", "limit=5", "view=", "view=all", "view=Upcoming",
		"view=upcoming&view=past", "view=upcoming&view=upcoming",
		"view=upcoming&extra=1", "view=upcoming&date=2026-11-03",
		"view=upcoming&limit=", "view=upcoming&limit=0", "view=upcoming&limit=101",
		"view=upcoming&limit=-1", "view=upcoming&limit=+5", "view=upcoming&limit=5.5", "view=upcoming&limit=abc",
		"view=upcoming&limit=5&limit=6",
		"view=upcoming&offset=", "view=upcoming&offset=-1", "view=upcoming&offset=x",
		"view=upcoming&offset=99999999999999999999999",
		"view=upcoming&offset=1&offset=2",
	}
	for _, raw := range invalid {
		values, _ := url.ParseQuery(raw)
		if got, err := parseOwnList(values); err == nil {
			t.Fatalf("%q accepted as %+v", raw, got)
		}
	}
}

// RN-02 boundary: now == starts_at - 4h is still cancellable; one nanosecond later it is not.
func TestOwnCancellable(t *testing.T) {
	start := time.Date(2026, 11, 3, 18, 0, 0, 0, time.UTC)
	limit := start.Add(-CancellationWindow)
	cases := []struct {
		name, kind, status string
		now                time.Time
		want               bool
	}{
		{"exact limit", "reservation", "reserved", limit, true},
		{"one nanosecond late", "reservation", "reserved", limit.Add(time.Nanosecond), false},
		{"well before", "reservation", "reserved", limit.Add(-24 * time.Hour), true},
		{"already cancelled", "reservation", "cancelled", limit.Add(-time.Hour), false},
		{"match never cancellable", "match", "reserved", limit.Add(-time.Hour), false},
	}
	for _, tc := range cases {
		if got := ownCancellable(tc.kind, tc.status, tc.now, start); got != tc.want {
			t.Errorf("%s: got %v want %v", tc.name, got, tc.want)
		}
	}
}
