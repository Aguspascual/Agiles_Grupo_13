package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"
)

type leaveMatchResponse struct {
	Match struct {
		ID      string `json:"id"`
		Status  string `json:"status"`
		Missing int    `json:"missingPlayers"`
		Players []any  `json:"players"`
	} `json:"match"`
}

func TestHTTPLeaveFullMatchReopensAndNotifiesRemainingPlayers(t *testing.T) {
	now := myNow(t)
	f := newManualFixture(t).clockServer(t, now)
	organizer := f.userID(t, "manual-player@example.com")
	playerB, tokenB := f.registerPlayer(t, "leave-b@example.com")
	playerC, _ := f.registerPlayer(t, "leave-c@example.com")
	playerD, _ := f.registerPlayer(t, "leave-d@example.com")
	weekday := (int(now.Weekday())+6)%7 + 1
	var scheduleDay string
	if err := f.db.QueryRow(f.ctx, `INSERT INTO court_schedule_days(court_id,weekday,enabled,duration_minutes) VALUES($1,$2,true,60)
		ON CONFLICT(court_id,weekday) DO UPDATE SET enabled=true,duration_minutes=60 RETURNING id::text`, f.courtID, weekday).Scan(&scheduleDay); err != nil {
		t.Fatal(err)
	}
	if _, err := f.db.Exec(f.ctx, `DELETE FROM court_schedule_intervals WHERE schedule_day_id=$1`, scheduleDay); err != nil {
		t.Fatal(err)
	}
	if _, err := f.db.Exec(f.ctx, `INSERT INTO court_schedule_intervals(schedule_day_id,opens_at,closes_at) VALUES($1,'18:00','23:00')`, scheduleDay); err != nil {
		t.Fatal(err)
	}
	starts, ends := now.Add(6*time.Hour), now.Add(7*time.Hour)
	matchID, reservationID := f.insertMatch(t, organizer, []string{playerB, playerC, playerD}, "5ta", "full", "reserved", starts, ends)
	if _, err := f.db.Exec(f.ctx, `INSERT INTO pending_match_notices(match_id,user_id,kind)
		SELECT match_id,user_id,'match_completed' FROM pending_match_players WHERE match_id=$1`, matchID); err != nil {
		t.Fatal(err)
	}

	reply := f.request("DELETE", "/api/v1/matches/"+matchID+"/players/me", tokenB, "")
	data := string(expectManual(t, reply, 200))
	var response leaveMatchResponse
	if err := json.Unmarshal([]byte(data), &response); err != nil {
		t.Fatal(err)
	}
	if response.Match.Status != "open" || response.Match.Missing != 1 || len(response.Match.Players) != 3 {
		t.Fatalf("updated match=%+v", response.Match)
	}
	if reply.header.Get("Cache-Control") != "no-store" {
		t.Fatalf("Cache-Control=%q", reply.header.Get("Cache-Control"))
	}
	if f.count(t, `SELECT count(*) FROM pending_match_players WHERE match_id=$1`, matchID) != 3 || f.count(t, `SELECT count(*) FROM pending_match_players WHERE match_id=$1 AND user_id=$2`, matchID, playerB) != 0 {
		t.Fatal("the leaving player was not removed cleanly")
	}
	if f.count(t, `SELECT count(*) FROM pending_match_notices WHERE match_id=$1 AND kind='player_left'`, matchID) != 3 {
		t.Fatal("expected notices for the organizer and two remaining players")
	}
	if f.count(t, `SELECT count(*) FROM pending_match_notices WHERE match_id=$1 AND user_id=$2 AND kind='player_left'`, matchID, playerB) != 0 {
		t.Fatal("the player who left must not receive a notice")
	}
	if f.count(t, `SELECT count(*) FROM pending_match_notices WHERE match_id=$1 AND user_id=$2 AND kind='player_left'`, matchID, organizer) != 1 {
		t.Fatal("the organizer did not receive a player_left notice")
	}
	if f.count(t, `SELECT count(*) FROM reservations WHERE id=$1 AND status='reserved'`, reservationID) != 1 {
		t.Fatal("leaving the match must not cancel its court reservation")
	}
	slotsPath := fmt.Sprintf("/api/v1/complexes/%s/slots?date=%s", f.complexID, now.Format("2006-01-02"))
	slots := string(expectManual(t, f.request("GET", slotsPath, "", ""), 200))
	if !strings.Contains(slots, `"startsAt":"18:00","endsAt":"19:00","status":"PENDING_MATCH","isPast":false,"pendingMatch":{"missingPlayers":1,"level":"5ta"}`) {
		t.Fatalf("the public court grid must continue showing the booked turn: %s", slots)
	}
	publicMatches := string(expectManual(t, f.request("GET", "/api/v1/matches", "", ""), 200))
	if !strings.Contains(publicMatches, `"id":"`+matchID+`"`) || !strings.Contains(publicMatches, `"status":"open"`) {
		t.Fatalf("reopened match is not visible in public search: %s", publicMatches)
	}
	notices := string(expectManual(t, f.request("GET", "/api/v1/match-notices", organizerToken(f), ""), 200))
	if !strings.Contains(notices, `"kind":"player_left"`) {
		t.Fatalf("notice kind missing: %s", notices)
	}

	// A later completion must notify all four again; repeated kinds are not unique.
	rejoined := f.request("POST", "/api/v1/matches/"+matchID+"/players", tokenB, "")
	expectManual(t, rejoined, 200)
	if f.count(t, `SELECT count(*) FROM pending_match_notices WHERE match_id=$1 AND kind='match_completed'`, matchID) != 8 {
		t.Fatal("the original and repeated completion should each notify all four players")
	}
	for _, playerID := range []string{organizer, playerB, playerC, playerD} {
		if f.count(t, `SELECT count(*) FROM pending_match_notices WHERE match_id=$1 AND user_id=$2 AND kind='match_completed'`, matchID, playerID) != 2 {
			t.Fatalf("player %s did not receive the second completion notice", playerID)
		}
	}
}

func TestHTTPLeaveValidationAndIdempotency(t *testing.T) {
	now := myNow(t)
	f := newManualFixture(t).clockServer(t, now)
	organizer := f.userID(t, "manual-player@example.com")
	playerB, tokenB := f.registerPlayer(t, "leave-validation@example.com")
	starts, ends := now.Add(3*time.Hour), now.Add(4*time.Hour)
	matchID, _ := f.insertMatch(t, organizer, []string{playerB}, "5ta", "open", "reserved", starts, ends)

	for _, tc := range []struct {
		name, path, token, body string
		status                  int
	}{
		{"no token", "/api/v1/matches/" + matchID + "/players/me", "", "", 401},
		{"invalid token", "/api/v1/matches/" + matchID + "/players/me", "invalid", "", 401},
		{"invalid UUID", "/api/v1/matches/not-a-uuid/players/me", tokenB, "", 400},
		{"unexpected query", "/api/v1/matches/" + matchID + "/players/me?force=1", tokenB, "", 400},
		{"unexpected body", "/api/v1/matches/" + matchID + "/players/me", tokenB, `{}`, 400},
		{"unknown match", "/api/v1/matches/" + unknownUUID + "/players/me", tokenB, "", 404},
		{"organizer", "/api/v1/matches/" + matchID + "/players/me", f.player, "", 409},
	} {
		t.Run(tc.name, func(t *testing.T) {
			expectManual(t, f.request("DELETE", tc.path, tc.token, tc.body), tc.status)
		})
	}

	// A user not enrolled in this match gets an idempotent response even after the deadline.
	late := now.Add(2*time.Hour + time.Nanosecond)
	lateFixture := f.clockServer(t, late)
	before := f.count(t, `SELECT count(*) FROM pending_match_notices WHERE match_id=$1`, matchID)
	other := f.admin
	reply := lateFixture.request("DELETE", "/api/v1/matches/"+matchID+"/players/me", other, "")
	data := string(expectManual(t, reply, 200))
	if !strings.Contains(data, `"id":"`+matchID+`"`) || f.count(t, `SELECT count(*) FROM pending_match_notices WHERE match_id=$1`, matchID) != before {
		t.Fatalf("idempotent leave changed state or returned an unexpected match: %s", data)
	}
	startedID, _ := f.insertMatch(t, organizer, nil, "5ta", "open", "reserved", now.Add(-time.Minute), now.Add(time.Hour))
	startedReply := f.request("DELETE", "/api/v1/matches/"+startedID+"/players/me", other, "")
	expectManual(t, startedReply, 200)

	cancelledID, _ := f.insertMatch(t, organizer, []string{playerB}, "5ta", "open", "cancelled", starts.Add(time.Hour), ends.Add(time.Hour))
	expectManual(t, f.request("DELETE", "/api/v1/matches/"+cancelledID+"/players/me", tokenB, ""), 404)
}

func TestHTTPLeaveTwoHourBoundaryIsInclusive(t *testing.T) {
	base := myNow(t)
	for _, tc := range []struct {
		name       string
		now        time.Time
		wantStatus int
	}{
		{"exact boundary", base, 200},
		{"one nanosecond after", base.Add(time.Nanosecond), 409},
		{"already started", base.Add(3 * time.Hour), 409},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newManualFixture(t).clockServer(t, tc.now)
			organizer := f.userID(t, "manual-player@example.com")
			playerID, token := f.registerPlayer(t, "leave-boundary@example.com")
			start := base.Add(2 * time.Hour)
			matchID, _ := f.insertMatch(t, organizer, []string{playerID}, "5ta", "open", "reserved", start, start.Add(time.Hour))
			path := fmt.Sprintf("/api/v1/matches/%s/players/me", matchID)
			expectManual(t, f.request("DELETE", path, token, ""), tc.wantStatus)
		})
	}
}

func TestHTTPLeaveDuplicateRequestsAreIdempotent(t *testing.T) {
	now := myNow(t)
	f := newManualFixture(t).clockServer(t, now)
	organizer := f.userID(t, "manual-player@example.com")
	playerID, token := f.registerPlayer(t, "leave-duplicate@example.com")
	matchID, _ := f.insertMatch(t, organizer, []string{playerID}, "5ta", "open", "reserved", now.Add(4*time.Hour), now.Add(5*time.Hour))
	path := "/api/v1/matches/" + matchID + "/players/me"

	var wait sync.WaitGroup
	statuses := make(chan int, 2)
	for range 2 {
		wait.Add(1)
		go func() {
			defer wait.Done()
			statuses <- f.request("DELETE", path, token, "").status
		}()
	}
	wait.Wait()
	close(statuses)
	for status := range statuses {
		if status != 200 {
			t.Fatalf("duplicate leave status=%d, want 200", status)
		}
	}
	if f.count(t, `SELECT count(*) FROM pending_match_notices WHERE match_id=$1 AND kind='player_left'`, matchID) != 1 {
		t.Fatal("duplicate requests must create notices only once")
	}
}

func TestHTTPDifferentPlayersCanLeaveConcurrently(t *testing.T) {
	now := myNow(t)
	f := newManualFixture(t).clockServer(t, now)
	organizer := f.userID(t, "manual-player@example.com")
	playerB, tokenB := f.registerPlayer(t, "leave-parallel-b@example.com")
	playerC, tokenC := f.registerPlayer(t, "leave-parallel-c@example.com")
	matchID, _ := f.insertMatch(t, organizer, []string{playerB, playerC}, "5ta", "open", "reserved", now.Add(4*time.Hour), now.Add(5*time.Hour))
	path := "/api/v1/matches/" + matchID + "/players/me"
	var wait sync.WaitGroup
	statuses := make(chan int, 2)
	for _, token := range []string{tokenB, tokenC} {
		wait.Add(1)
		go func(token string) {
			defer wait.Done()
			statuses <- f.request("DELETE", path, token, "").status
		}(token)
	}
	wait.Wait()
	close(statuses)
	for status := range statuses {
		if status != 200 {
			t.Fatalf("concurrent leave status=%d, want 200", status)
		}
	}
	if f.count(t, `SELECT count(*) FROM pending_match_players WHERE match_id=$1`, matchID) != 1 {
		t.Fatal("both concurrent leaves must leave only the organizer")
	}
	if f.count(t, `SELECT count(*) FROM pending_match_notices WHERE match_id=$1 AND kind='player_left'`, matchID) != 3 {
		t.Fatal("the organizer and the remaining player should receive one notice per leave")
	}
	if f.count(t, `SELECT count(*) FROM pending_match_notices WHERE match_id=$1 AND user_id=$2 AND kind='player_left'`, matchID, organizer) != 2 {
		t.Fatal("the organizer should be notified about both departures")
	}
}

func TestHTTPLeaveRollsBackWhenNoticeInsertFails(t *testing.T) {
	now := myNow(t)
	f := newManualFixture(t).clockServer(t, now)
	organizer := f.userID(t, "manual-player@example.com")
	playerB, tokenB := f.registerPlayer(t, "leave-rollback-b@example.com")
	playerC, _ := f.registerPlayer(t, "leave-rollback-c@example.com")
	playerD, _ := f.registerPlayer(t, "leave-rollback-d@example.com")
	matchID, _ := f.insertMatch(t, organizer, []string{playerB, playerC, playerD}, "5ta", "full", "reserved", now.Add(4*time.Hour), now.Add(5*time.Hour))
	if _, err := f.db.Exec(f.ctx, `ALTER TABLE pending_match_notices ADD CONSTRAINT test_reject_player_left CHECK(kind <> 'player_left')`); err != nil {
		t.Fatal(err)
	}
	path := "/api/v1/matches/" + matchID + "/players/me"
	expectManual(t, f.request("DELETE", path, tokenB, ""), 500)
	if f.count(t, `SELECT count(*) FROM pending_match_players WHERE match_id=$1`, matchID) != 4 || f.count(t, `SELECT count(*) FROM pending_matches WHERE id=$1 AND status='full'`, matchID) != 1 {
		t.Fatal("failed notice insertion did not roll back membership and status")
	}
	if f.count(t, `SELECT count(*) FROM pending_match_notices WHERE match_id=$1`, matchID) != 0 {
		t.Fatal("failed leave inserted a partial notice")
	}
}

func TestHTTPLeaveRacesWithJoinWithoutLosingParticipants(t *testing.T) {
	now := myNow(t)
	f := newManualFixture(t).clockServer(t, now)
	organizer := f.userID(t, "manual-player@example.com")
	playerB, leaveToken := f.registerPlayer(t, "leave-race-b@example.com")
	playerC, _ := f.registerPlayer(t, "leave-race-c@example.com")
	playerD, joinToken := f.registerPlayer(t, "leave-race-d@example.com")
	matchID, _ := f.insertMatch(t, organizer, []string{playerB, playerC}, "5ta", "open", "reserved", now.Add(4*time.Hour), now.Add(5*time.Hour))
	var wait sync.WaitGroup
	statuses := make(chan int, 2)
	wait.Add(2)
	go func() {
		defer wait.Done()
		statuses <- f.request("DELETE", "/api/v1/matches/"+matchID+"/players/me", leaveToken, "").status
	}()
	go func() {
		defer wait.Done()
		statuses <- f.request("POST", "/api/v1/matches/"+matchID+"/players", joinToken, "").status
	}()
	wait.Wait()
	close(statuses)
	for status := range statuses {
		if status != 200 {
			t.Fatalf("join/leave race status=%d, want 200", status)
		}
	}
	if f.count(t, `SELECT count(*) FROM pending_match_players WHERE match_id=$1`, matchID) != 3 {
		t.Fatal("concurrent join and leave did not preserve the expected three players")
	}
	if f.count(t, `SELECT count(*) FROM pending_match_players WHERE match_id=$1 AND user_id=$2`, matchID, playerD) != 1 {
		t.Fatal("the joining player was lost")
	}
	if f.count(t, `SELECT count(*) FROM reservations WHERE id=(SELECT reservation_id FROM pending_matches WHERE id=$1) AND status='reserved'`, matchID) != 1 {
		t.Fatal("the court reservation must remain reserved")
	}
}

func organizerToken(f *manualFixture) string { return f.player }
