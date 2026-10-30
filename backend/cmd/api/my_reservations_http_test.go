package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"
)

type myItem struct {
	Kind          string `json:"kind"`
	ID            string `json:"id"`
	ReservationID string `json:"reservationId"`
	Status        string `json:"status"`
	Complex       struct{ ID, Name string }
	Court         struct{ ID, Name string }
	StartsAt      string `json:"startsAt"`
	EndsAt        string `json:"endsAt"`
	TimeZone      string `json:"timeZone"`
	Role          string `json:"role"`
	Cancellable   bool   `json:"cancellable"`
	Match         *struct {
		Status         string `json:"status"`
		TargetLevel    string `json:"targetLevel"`
		MissingPlayers int    `json:"missingPlayers"`
	} `json:"match"`
}

type myList struct {
	Items []myItem `json:"items"`
	Page  struct {
		Limit   int  `json:"limit"`
		Offset  int  `json:"offset"`
		HasMore bool `json:"hasMore"`
	} `json:"page"`
}

// Fixed server instant used by every test: 2026-11-03 12:00 Buenos Aires.
func myNow(t *testing.T) time.Time {
	t.Helper()
	loc, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	return time.Date(2026, 11, 3, 12, 0, 0, 0, loc)
}

func (f *manualFixture) registerPlayer(t *testing.T, email string) (string, string) {
	t.Helper()
	body := fmt.Sprintf(`{"name":"Other","email":%q,"password":"TestPassword-123!","zone":"Gonnet","level":"7ma","fairPlay":true}`, email)
	data := expectManual(t, f.request("POST", "/api/v1/auth/register", "", body), 201)
	var session struct {
		Token string
		User  struct{ ID string }
	}
	if err := json.Unmarshal(data, &session); err != nil {
		t.Fatal(err)
	}
	return session.User.ID, session.Token
}

func (f *manualFixture) insertMatch(t *testing.T, organizer string, players []string, level, matchStatus, reservationStatus string, starts, ends time.Time) (matchID, reservationID string) {
	t.Helper()
	err := f.db.QueryRow(f.ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,starts_at,ends_at,status,companions,contact_name,contact_phone,origin,registered_by)
		VALUES($1,$2,$3,$4,$5,$6,3,'Private organizer','','open_match',$3) RETURNING id::text`,
		f.complexID, f.courtID, organizer, starts, ends, reservationStatus).Scan(&reservationID)
	if err != nil {
		t.Fatal(err)
	}
	if err := f.db.QueryRow(f.ctx, `INSERT INTO pending_matches(reservation_id,target_level,status) VALUES($1,$2,$3) RETURNING id::text`,
		reservationID, level, matchStatus).Scan(&matchID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.db.Exec(f.ctx, `INSERT INTO pending_match_players(match_id,user_id,is_organizer) VALUES($1,$2,true)`, matchID, organizer); err != nil {
		t.Fatal(err)
	}
	for _, player := range players {
		if _, err := f.db.Exec(f.ctx, `INSERT INTO pending_match_players(match_id,user_id) VALUES($1,$2)`, matchID, player); err != nil {
			t.Fatal(err)
		}
	}
	return matchID, reservationID
}

func (f *manualFixture) mine(t *testing.T, token, query string) myList {
	t.Helper()
	reply := f.request("GET", "/api/v1/me/reservations?"+query, token, "")
	body := expectManual(t, reply, 200)
	if reply.header.Get("Cache-Control") != "no-store" {
		t.Fatalf("Cache-Control=%q", reply.header.Get("Cache-Control"))
	}
	var list myList
	if err := json.Unmarshal(body, &list); err != nil {
		t.Fatal(err)
	}
	return list
}

func ids(list myList) []string {
	out := make([]string, 0, len(list.Items))
	for _, item := range list.Items {
		out = append(out, item.ID)
	}
	return out
}

func sameIDs(t *testing.T, label string, got myList, want ...string) {
	t.Helper()
	if strings.Join(ids(got), ",") != strings.Join(want, ",") {
		t.Fatalf("%s: ids=%v want=%v", label, ids(got), want)
	}
}

func TestHTTPMyReservationsValidation(t *testing.T) {
	f := newManualFixture(t).clockServer(t, myNow(t))
	for _, tc := range []struct {
		name, token, query string
		status             int
	}{
		{"no token", "", "view=upcoming", 401},
		{"invalid token", "invalid", "view=upcoming", 401},
		{"missing view", f.player, "", 400},
		{"unknown view", f.player, "view=all", 400},
		{"unknown param", f.player, "view=upcoming&date=2026-11-03", 400},
		{"repeated view", f.player, "view=upcoming&view=past", 400},
		{"empty limit", f.player, "view=upcoming&limit=", 400},
		{"limit too high", f.player, "view=upcoming&limit=101", 400},
		{"negative offset", f.player, "view=upcoming&offset=-1", 400},
	} {
		t.Run(tc.name, func(t *testing.T) {
			expectManual(t, f.request("GET", "/api/v1/me/reservations?"+tc.query, tc.token, ""), tc.status)
		})
	}
}

func TestHTTPMyReservationsEmptyAndShape(t *testing.T) {
	f := newManualFixture(t).clockServer(t, myNow(t))
	empty := expectManual(t, f.request("GET", "/api/v1/me/reservations?view=upcoming", f.player, ""), 200)
	if string(empty) != `{"items":[],"page":{"limit":20,"offset":0,"hasMore":false}}`+"\n" && string(empty) != `{"items":[],"page":{"limit":20,"offset":0,"hasMore":false}}` {
		t.Fatalf("empty body=%s", empty)
	}

	playerID := f.userID(t, "manual-player@example.com")
	now := myNow(t)
	web := f.insertReservation(t, "web", playerID, now.Add(8*time.Hour), now.Add(9*time.Hour))
	reply := f.request("GET", "/api/v1/me/reservations?view=upcoming&limit=100", f.player, "")
	body := string(expectManual(t, reply, 200))
	for _, leak := range []string{"Private client", "555-PRIVATE", "manual-player@example.com", "contact", "email", "phone"} {
		if strings.Contains(body, leak) {
			t.Fatalf("response leaks %q: %s", leak, body)
		}
	}
	list := f.mine(t, f.player, "view=upcoming&limit=100")
	var found *myItem
	for i := range list.Items {
		if list.Items[i].ID == web {
			found = &list.Items[i]
		}
	}
	if found == nil {
		t.Fatalf("reservation %s missing from %v", web, ids(list))
	}
	if found.Kind != "reservation" || found.ReservationID != web || found.Status != "reserved" || found.Role != "organizer" ||
		!found.Cancellable || found.Match != nil || found.Complex.ID != f.complexID || found.Court.ID != f.courtID ||
		found.Complex.Name != "Manual club" || found.Court.Name != "Court" || found.TimeZone != "America/Argentina/Buenos_Aires" ||
		found.StartsAt != now.Add(8*time.Hour).Format(time.RFC3339) || !strings.HasSuffix(found.StartsAt, "-03:00") {
		t.Fatalf("unexpected item %+v", *found)
	}
}

func TestHTTPMyReservationsUpcomingAndPast(t *testing.T) {
	f := newManualFixture(t).clockServer(t, myNow(t))
	now := myNow(t)
	playerID := f.userID(t, "manual-player@example.com")
	_, otherToken := f.registerPlayer(t, "someone-else@example.com")

	ended := f.insertReservation(t, "web", playerID, now.Add(-2*time.Hour), now)                      // ends_at == now => past
	running := f.insertReservation(t, "web", playerID, now.Add(-time.Hour), now.Add(30*time.Minute))   // in progress => upcoming
	later := f.insertReservation(t, "web", playerID, now.Add(24*time.Hour), now.Add(25*time.Hour))     // upcoming
	old := f.insertReservation(t, "web", playerID, now.Add(-72*time.Hour), now.Add(-71*time.Hour))     // past
	manual := f.insertReservation(t, "manual", "", now.Add(48*time.Hour), now.Add(49*time.Hour))       // never listed
	cancelledOld := f.insertReservation(t, "web", playerID, now.Add(-96*time.Hour), now.Add(-95*time.Hour))
	cancelledNext := f.insertReservation(t, "web", playerID, now.Add(30*time.Hour), now.Add(31*time.Hour))
	if _, err := f.db.Exec(f.ctx, `UPDATE reservations SET status='cancelled' WHERE id IN ($1,$2)`, cancelledOld, cancelledNext); err != nil {
		t.Fatal(err)
	}
	_ = manual

	upcoming := f.mine(t, f.player, "view=upcoming")
	sameIDs(t, "upcoming", upcoming, running, later, cancelledNext)
	past := f.mine(t, f.player, "view=past")
	sameIDs(t, "past", past, ended, old, cancelledOld)

	byID := map[string]myItem{}
	for _, item := range append(upcoming.Items, past.Items...) {
		byID[item.ID] = item
	}
	if byID[cancelledNext].Status != "cancelled" || byID[cancelledNext].Cancellable {
		t.Fatalf("cancelled item %+v", byID[cancelledNext])
	}
	if byID[later].Status != "reserved" || !byID[later].Cancellable || byID[running].Cancellable || byID[ended].Cancellable {
		t.Fatalf("cancellable flags wrong: later=%+v running=%+v ended=%+v", byID[later], byID[running], byID[ended])
	}

	sameIDs(t, "other user upcoming", f.mine(t, otherToken, "view=upcoming"))
	sameIDs(t, "other user past", f.mine(t, otherToken, "view=past"))
}

func TestHTTPMyReservationsCancellableBoundary(t *testing.T) {
	now := myNow(t)
	for _, tc := range []struct {
		name  string
		start time.Time
		want  bool
	}{
		{"exactly 4h", now.Add(4 * time.Hour), true},
		{"4h minus 1s", now.Add(4*time.Hour - time.Second), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newManualFixture(t).clockServer(t, now)
			playerID := f.userID(t, "manual-player@example.com")
			id := f.insertReservation(t, "web", playerID, tc.start, tc.start.Add(time.Hour))
			list := f.mine(t, f.player, "view=upcoming")
			sameIDs(t, tc.name, list, id)
			if list.Items[0].Cancellable != tc.want {
				t.Fatalf("cancellable=%v want=%v", list.Items[0].Cancellable, tc.want)
			}
		})
	}
}

func TestHTTPMyReservationsMatches(t *testing.T) {
	f := newManualFixture(t).clockServer(t, myNow(t))
	now := myNow(t)
	organizerID := f.userID(t, "manual-player@example.com")
	joinerID, joinerToken := f.registerPlayer(t, "joiner@example.com")
	extraID, _ := f.registerPlayer(t, "extra@example.com")
	thirdID, _ := f.registerPlayer(t, "third@example.com")

	openMatch, openRes := f.insertMatch(t, organizerID, []string{joinerID}, "5ta", "open", "reserved", now.Add(24*time.Hour), now.Add(25*time.Hour+30*time.Minute))
	fullMatch, _ := f.insertMatch(t, organizerID, []string{joinerID, extraID, thirdID}, "6ta", "full", "reserved", now.Add(48*time.Hour), now.Add(49*time.Hour))
	cancelledMatch, _ := f.insertMatch(t, organizerID, nil, "7ma", "open", "cancelled", now.Add(72*time.Hour), now.Add(73*time.Hour))
	pastMatch, _ := f.insertMatch(t, organizerID, []string{joinerID}, "4ta", "open", "reserved", now.Add(-48*time.Hour), now.Add(-47*time.Hour))
	web := f.insertReservation(t, "web", organizerID, now.Add(5*time.Hour), now.Add(6*time.Hour))

	organizer := f.mine(t, f.player, "view=upcoming")
	sameIDs(t, "organizer upcoming", organizer, web, openMatch, fullMatch, cancelledMatch)
	for _, item := range organizer.Items {
		if item.ReservationID == openRes && item.Kind == "reservation" {
			t.Fatal("organized match duplicated as reservation")
		}
	}
	byID := map[string]myItem{}
	for _, item := range organizer.Items {
		byID[item.ID] = item
	}
	if m := byID[openMatch]; m.Kind != "match" || m.ReservationID != openRes || m.Role != "organizer" || m.Cancellable || m.Status != "reserved" ||
		m.Match == nil || m.Match.Status != "open" || m.Match.TargetLevel != "5ta" || m.Match.MissingPlayers != 2 {
		t.Fatalf("open match %+v", m)
	}
	if m := byID[fullMatch]; m.Match == nil || m.Match.Status != "full" || m.Match.MissingPlayers != 0 || m.Match.TargetLevel != "6ta" {
		t.Fatalf("full match %+v", m)
	}
	if m := byID[cancelledMatch]; m.Status != "cancelled" || m.Match == nil || m.Match.Status != "open" || m.Match.MissingPlayers != 3 || m.Cancellable {
		t.Fatalf("cancelled match %+v", m)
	}
	if byID[web].Kind != "reservation" {
		t.Fatalf("web %+v", byID[web])
	}
	sameIDs(t, "organizer past", f.mine(t, f.player, "view=past"), pastMatch)

	joiner := f.mine(t, joinerToken, "view=upcoming")
	sameIDs(t, "joiner upcoming", joiner, openMatch, fullMatch)
	for _, item := range joiner.Items {
		if item.Role != "player" || item.Kind != "match" || item.Cancellable {
			t.Fatalf("joiner item %+v", item)
		}
	}
	sameIDs(t, "joiner past", f.mine(t, joinerToken, "view=past"), pastMatch)

	reply := f.request("GET", "/api/v1/me/reservations?view=upcoming", joinerToken, "")
	body := string(expectManual(t, reply, 200))
	for _, leak := range []string{"Private organizer", "manual-player@example.com", "extra@example.com", "joiner@example.com", "Other"} {
		if strings.Contains(body, leak) {
			t.Fatalf("response leaks %q: %s", leak, body)
		}
	}
}

func TestHTTPMyReservationsSoftDeletedResources(t *testing.T) {
	f := newManualFixture(t).clockServer(t, myNow(t))
	now := myNow(t)
	playerID := f.userID(t, "manual-player@example.com")
	web := f.insertReservation(t, "web", playerID, now.Add(24*time.Hour), now.Add(25*time.Hour))
	match, _ := f.insertMatch(t, playerID, nil, "5ta", "open", "reserved", now.Add(48*time.Hour), now.Add(49*time.Hour))
	if _, err := f.db.Exec(f.ctx, `UPDATE courts SET deleted_at=now() WHERE id=$1`, f.courtID); err != nil {
		t.Fatal(err)
	}
	sameIDs(t, "soft-deleted court", f.mine(t, f.player, "view=upcoming"), web, match)
	if _, err := f.db.Exec(f.ctx, `UPDATE complexes SET deleted_at=now() WHERE id=$1`, f.complexID); err != nil {
		t.Fatal(err)
	}
	sameIDs(t, "soft-deleted complex", f.mine(t, f.player, "view=upcoming"), web, match)
}

func TestHTTPMyReservationsOrderAndPagination(t *testing.T) {
	f := newManualFixture(t).clockServer(t, myNow(t))
	now := myNow(t)
	playerID := f.userID(t, "manual-player@example.com")
	start := now.Add(24 * time.Hour)
	var tied []string
	for range 2 {
		tied = append(tied, f.insertReservation(t, "web", playerID, start, start.Add(time.Hour)))
	}
	match, _ := f.insertMatch(t, playerID, nil, "5ta", "open", "reserved", start, start.Add(time.Hour))
	tied = append(tied, match)
	earlier := f.insertReservation(t, "web", playerID, start.Add(-3*time.Hour), start.Add(-2*time.Hour))
	later := f.insertReservation(t, "web", playerID, start.Add(10*time.Hour), start.Add(11*time.Hour))
	sortStrings(tied)

	want := append(append([]string{earlier}, tied...), later)
	sameIDs(t, "ascending with id tiebreak", f.mine(t, f.player, "view=upcoming"), want...)

	first := f.mine(t, f.player, "view=upcoming&limit=2")
	sameIDs(t, "page 1", first, want[:2]...)
	if !first.Page.HasMore || first.Page.Limit != 2 || first.Page.Offset != 0 {
		t.Fatalf("page 1 %+v", first.Page)
	}
	second := f.mine(t, f.player, "view=upcoming&limit=2&offset=2")
	sameIDs(t, "page 2", second, want[2:4]...)
	if !second.Page.HasMore || second.Page.Offset != 2 {
		t.Fatalf("page 2 %+v", second.Page)
	}
	last := f.mine(t, f.player, "view=upcoming&limit=2&offset=4")
	sameIDs(t, "page 3", last, want[4:]...)
	if last.Page.HasMore {
		t.Fatalf("page 3 %+v", last.Page)
	}
	beyond := f.mine(t, f.player, "view=upcoming&limit=2&offset=50")
	sameIDs(t, "beyond", beyond)
	if beyond.Page.HasMore {
		t.Fatalf("beyond %+v", beyond.Page)
	}

	// Past view is descending by start, then id.
	p1 := f.insertReservation(t, "web", playerID, now.Add(-10*time.Hour), now.Add(-9*time.Hour))
	p2 := f.insertReservation(t, "web", playerID, now.Add(-30*time.Hour), now.Add(-29*time.Hour))
	p3a := f.insertReservation(t, "web", playerID, now.Add(-20*time.Hour), now.Add(-19*time.Hour))
	p3b := f.insertReservation(t, "web", playerID, now.Add(-20*time.Hour), now.Add(-19*time.Hour))
	pair := []string{p3a, p3b}
	sortStrings(pair)
	sameIDs(t, "past descending", f.mine(t, f.player, "view=past"), p1, pair[1], pair[0], p2)
}

func sortStrings(values []string) {
	for i := 1; i < len(values); i++ {
		for j := i; j > 0 && values[j] < values[j-1]; j-- {
			values[j], values[j-1] = values[j-1], values[j]
		}
	}
}

func TestHTTPMyReservationsDoesNotModifyData(t *testing.T) {
	f := newManualFixture(t).clockServer(t, myNow(t))
	now := myNow(t)
	playerID := f.userID(t, "manual-player@example.com")
	f.insertReservation(t, "web", playerID, now.Add(24*time.Hour), now.Add(25*time.Hour))
	f.insertMatch(t, playerID, nil, "5ta", "open", "reserved", now.Add(48*time.Hour), now.Add(49*time.Hour))
	before := f.snapshot(t)
	f.mine(t, f.player, "view=upcoming")
	f.mine(t, f.player, "view=past")
	if f.snapshot(t) != before {
		t.Fatal("listing modified stored data")
	}
}
