package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/migrations"
)

type absenceState struct {
	MatchID    string    `json:"matchId"`
	EndsAt     time.Time `json:"endsAt"`
	Deadline   time.Time `json:"deadline"`
	ServerNow  time.Time `json:"serverNow"`
	WindowOpen bool      `json:"windowOpen"`
	Players    []struct {
		ID           string `json:"id"`
		Name         string `json:"name"`
		IsSelf       bool   `json:"isSelf"`
		ReportCount  int    `json:"reportCount"`
		Confirmed    bool   `json:"confirmed"`
		ReportedByMe bool   `json:"reportedByMe"`
		CanReport    bool   `json:"canReport"`
	} `json:"players"`
}

// HU-19 TDD-0018: the database itself rejects forged, duplicate and destructive writes.
func TestHU19PostgresConstraints(t *testing.T) {
	f := newManualFixture(t)
	actor := f.userID(t, "manual-player@example.com")
	target, _ := f.registerPlayer(t, "absence-target@example.com")
	match, _ := f.insertMatch(t, actor, []string{target}, "7ma", "open", "reserved", myNow(t).Add(-2*time.Hour), myNow(t).Add(-time.Hour))
	insert := `INSERT INTO match_absence_reports(match_id,reported_user_id,reporter_user_id) VALUES($1,$2,$3)`
	for name, args := range map[string][]any{
		"self report":              {match, actor, actor},
		"non participant target":   {match, f.adminID, actor},
		"non participant reporter": {match, target, f.adminID},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := f.db.Exec(f.ctx, insert, args...)
			if err == nil {
				t.Fatal("expected PostgreSQL constraint violation")
			}
		})
	}
	if _, err := f.db.Exec(f.ctx, insert, match, target, actor); err != nil {
		t.Fatal(err)
	}
	if _, err := f.db.Exec(f.ctx, insert, match, target, actor); err == nil || !strings.Contains(err.Error(), "23505") {
		t.Fatalf("duplicate error=%v", err)
	}
	if _, err := f.db.Exec(f.ctx, `DELETE FROM pending_match_players WHERE match_id=$1 AND user_id=$2`, match, target); err == nil || !strings.Contains(err.Error(), "23503") {
		t.Fatalf("membership deletion error=%v", err)
	}
	if _, err := f.db.Exec(f.ctx, `DELETE FROM pending_matches WHERE id=$1`, match); err == nil || !strings.Contains(err.Error(), "23503") {
		t.Fatalf("match deletion error=%v", err)
	}
	var count int
	if err := f.db.QueryRow(f.ctx, `SELECT count(*) FROM match_absence_reports WHERE match_id=$1`, match).Scan(&count); err != nil || count != 1 {
		t.Fatalf("persisted reports=%d err=%v", count, err)
	}
}

// Development renamed HU-12's applied migration from 015 to 019. Migrate keys
// history by filename, so a database with the old key executes the SQL again.
// The drop-and-add DDL must remain safe on that already-migrated schema.
func TestHU19RenamedMigrationIsSafeForExistingDatabase(t *testing.T) {
	f := newManualFixture(t)
	var oldApplied bool
	if err := f.db.QueryRow(f.ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version IN ('015_incomplete_match_release.sql','019_incomplete_match_release.sql'))`).Scan(&oldApplied); err != nil {
		t.Fatal(err)
	}
	if !oldApplied {
		t.Fatal("fixture did not apply the old HU-12 migration name")
	}
	sql, err := migrations.Files.ReadFile("019_incomplete_match_release.sql")
	if errors.Is(err, fs.ErrNotExist) {
		sql, err = migrations.Files.ReadFile("015_incomplete_match_release.sql")
	}
	if err != nil {
		t.Fatal(err)
	}
	for _, statement := range strings.Split(string(sql), ";") {
		if strings.TrimSpace(statement) == "" {
			continue
		}
		if _, err := f.db.Exec(f.ctx, statement); err != nil {
			t.Fatalf("reapplying renamed HU-12 migration: %v", err)
		}
	}
	if _, err := f.db.Exec(f.ctx, `INSERT INTO schema_migrations(version) VALUES('019_incomplete_match_release.sql')`); err != nil {
		t.Fatalf("record renamed HU-12 migration: %v", err)
	}
	var newApplied bool
	if err := f.db.QueryRow(f.ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version='019_incomplete_match_release.sql')`).Scan(&newApplied); err != nil || !newApplied {
		t.Fatalf("renamed migration history newApplied=%v err=%v", newApplied, err)
	}
}

func absenceURL(match string) string   { return "/api/v1/matches/" + match + "/absence-reports" }
func absenceBody(player string) string { return fmt.Sprintf(`{"playerId":%q}`, player) }
func readAbsences(t *testing.T, reply manualReply, status int) absenceState {
	t.Helper()
	data := expectManual(t, reply, status)
	if reply.header.Get("Cache-Control") != "no-store" {
		t.Fatal("missing no-store")
	}
	var state absenceState
	if err := json.Unmarshal(data, &state); err != nil {
		t.Fatal(err)
	}
	return state
}

// HU-19 CA-01/02: the real reservation end defines the window, including exactly 48 h.
func TestHU19Window(t *testing.T) {
	f := newManualFixture(t)
	actor := f.userID(t, "manual-player@example.com")
	target, _ := f.registerPlayer(t, "absence-target@example.com")
	end := myNow(t)
	for _, tc := range []struct {
		name  string
		delta time.Duration
		want  int
	}{
		{"before end", -time.Microsecond, 409},
		{"exact end", 0, 201},
		{"within 48 hours", time.Hour, 201},
		{"exact 48 hours", 48 * time.Hour, 201},
		{"expired", 48*time.Hour + time.Microsecond, 409},
	} {
		t.Run(tc.name, func(t *testing.T) {
			match, _ := f.insertMatch(t, actor, []string{target}, "7ma", "open", "reserved", end.Add(-90*time.Minute), end)
			server := f.clockServer(t, end.Add(tc.delta))
			expectManual(t, server.request("POST", absenceURL(match), f.player, absenceBody(target)), tc.want)
			var count int
			if err := f.db.QueryRow(f.ctx, `SELECT count(*) FROM match_absence_reports WHERE match_id=$1`, match).Scan(&count); err != nil {
				t.Fatal(err)
			}
			if (count == 1) != (tc.want == 201) {
				t.Fatalf("count=%d", count)
			}
		})
	}
}

// HU-19 CA-01/04: token identity, participant permissions, self reports and strict input.
func TestHU19AuthorizationAndInput(t *testing.T) {
	f := newManualFixture(t).clockServer(t, myNow(t))
	actor := f.userID(t, "manual-player@example.com")
	target, _ := f.registerPlayer(t, "absence-target@example.com")
	match, _ := f.insertMatch(t, actor, []string{target}, "7ma", "open", "reserved", myNow(t).Add(-2*time.Hour), myNow(t).Add(-time.Hour))
	for _, tc := range []struct {
		name, token, id, body string
		want                  int
	}{
		{"anonymous", "", match, absenceBody(target), 401},
		{"invalid token", "invalid", match, absenceBody(target), 401},
		{"outsider even admin", f.admin, match, absenceBody(target), 403},
		{"target outsider", f.player, match, absenceBody(f.adminID), 400},
		{"self", f.player, match, absenceBody(actor), 400},
		{"unknown match", f.player, unknownUUID, absenceBody(target), 404},
		{"invalid match", f.player, "bad", absenceBody(target), 400},
		{"invalid player", f.player, match, absenceBody("bad"), 400},
		{"missing player", f.player, match, `{}`, 400},
		{"spoof actor", f.player, match, fmt.Sprintf(`{"playerId":%q,"reporterId":%q}`, target, f.adminID), 400},
		{"query", f.player, match + "/../" + match, `{}`, 400},
	} {
		if tc.name == "query" {
			continue
		}
		t.Run(tc.name, func(t *testing.T) { expectManual(t, f.request("POST", absenceURL(tc.id), tc.token, tc.body), tc.want) })
	}
	expectManual(t, f.request("POST", absenceURL(match)+"?reporterId="+actor, f.player, absenceBody(target)), 400)
	expectManual(t, f.request("GET", absenceURL(match), "", ""), 401)
	expectManual(t, f.request("GET", absenceURL(match), f.admin, ""), 403)
	expectManual(t, f.request("GET", absenceURL(match)+"?extra=1", f.player, ""), 400)
	var count int
	if err := f.db.QueryRow(f.ctx, `SELECT count(*) FROM match_absence_reports`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("count=%d err=%v", count, err)
	}
}

// HU-19 CA-03/04: persisted distinct votes, isolation and a fresh HTTP service readback.
func TestHU19ConfirmationPersistenceAndIsolation(t *testing.T) {
	f := newManualFixture(t).clockServer(t, myNow(t))
	actor := f.userID(t, "manual-player@example.com")
	target, targetToken := f.registerPlayer(t, "absence-target@example.com")
	second, secondToken := f.registerPlayer(t, "absence-second@example.com")
	match, _ := f.insertMatch(t, actor, []string{target, second}, "7ma", "open", "reserved", myNow(t).Add(-2*time.Hour), myNow(t).Add(-time.Hour))
	other, _ := f.insertMatch(t, actor, []string{target, second}, "7ma", "open", "reserved", myNow(t).Add(-3*time.Hour), myNow(t).Add(-2*time.Hour))
	state := readAbsences(t, f.request("POST", absenceURL(match), f.player, absenceBody(target)), 201)
	if !state.WindowOpen || len(state.Players) != 3 || state.MatchID != match || !state.Deadline.Equal(myNow(t).Add(47*time.Hour)) {
		t.Fatalf("state=%+v", state)
	}
	for _, player := range state.Players {
		if player.ID == target && (player.ReportCount != 1 || player.Confirmed || !player.ReportedByMe || player.CanReport) {
			t.Fatalf("target=%+v", player)
		}
		if player.ID == actor && (!player.IsSelf || player.CanReport) {
			t.Fatalf("self=%+v", player)
		}
	}
	expectManual(t, f.request("POST", absenceURL(match), f.player, absenceBody(target)), 409)
	readAbsences(t, f.request("POST", absenceURL(match), secondToken, absenceBody(target)), 201)
	fresh := f.clockServer(t, myNow(t).Add(72*time.Hour))
	state = readAbsences(t, fresh.request("GET", absenceURL(match), targetToken, ""), 200)
	if state.WindowOpen {
		t.Fatal("expired window open")
	}
	found := false
	for _, player := range state.Players {
		if player.ID == target {
			found = true
			if player.ReportCount != 2 || !player.Confirmed || !player.IsSelf || player.ReportedByMe || player.CanReport {
				t.Fatalf("target=%+v", player)
			}
		}
	}
	if !found {
		t.Fatal("target missing")
	}
	state = readAbsences(t, f.request("GET", absenceURL(other), f.player, ""), 200)
	for _, player := range state.Players {
		if player.ReportCount != 0 || player.Confirmed {
			t.Fatal("cross-match leak")
		}
	}
	expectManual(t, f.request("POST", absenceURL(other), f.player, absenceBody(target)), 201)
}

// HU-19 CA-03/04: simultaneous independent votes and duplicate requests.
func TestHU19ConcurrentReports(t *testing.T) {
	f := newManualFixture(t).clockServer(t, myNow(t))
	actor := f.userID(t, "manual-player@example.com")
	target, _ := f.registerPlayer(t, "absence-target@example.com")
	second, secondToken := f.registerPlayer(t, "absence-second@example.com")
	for _, duplicate := range []bool{false, true} {
		match, _ := f.insertMatch(t, actor, []string{target, second}, "7ma", "open", "reserved", myNow(t).Add(-2*time.Hour), myNow(t).Add(-time.Hour))
		tokens := []string{f.player, secondToken}
		if duplicate {
			tokens[1] = f.player
		}
		start := make(chan struct{})
		replies := make(chan manualReply, 2)
		var wg sync.WaitGroup
		for _, token := range tokens {
			wg.Add(1)
			go func(token string) {
				defer wg.Done()
				<-start
				replies <- f.request("POST", absenceURL(match), token, absenceBody(target))
			}(token)
		}
		close(start)
		wg.Wait()
		close(replies)
		created, conflicts := 0, 0
		for reply := range replies {
			if reply.err != nil {
				t.Fatal(reply.err)
			}
			switch reply.status {
			case 201:
				created++
			case 409:
				conflicts++
			default:
				t.Fatalf("reply=%+v", reply)
			}
		}
		want := 2
		if duplicate {
			want = 1
		}
		if created != want || conflicts != 2-want {
			t.Fatalf("created=%d conflicts=%d", created, conflicts)
		}
		state := readAbsences(t, f.request("GET", absenceURL(match), f.player, ""), 200)
		for _, player := range state.Players {
			if player.ID == target && (player.ReportCount != want || player.Confirmed != !duplicate) {
				t.Fatalf("target=%+v", player)
			}
		}
	}
}

// HU-12 locks reservation before pending_match when cancelling an incomplete
// match. HU-19 must keep the same order to avoid a reservation/match deadlock.
func TestHU19CancellationLockOrder(t *testing.T) {
	f := newManualFixture(t).clockServer(t, myNow(t))
	actor := f.userID(t, "manual-player@example.com")
	target, _ := f.registerPlayer(t, "absence-target@example.com")
	match, reservation := f.insertMatch(t, actor, []string{target}, "7ma", "open", "reserved", myNow(t).Add(-2*time.Hour), myNow(t).Add(-time.Hour))
	workerTx, err := f.db.Begin(f.ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer workerTx.Rollback(f.ctx)
	if _, err := workerTx.Exec(f.ctx, `SELECT id FROM reservations WHERE id=$1::uuid FOR UPDATE`, reservation); err != nil {
		t.Fatal(err)
	}
	replyCh := make(chan manualReply, 1)
	go func() { replyCh <- f.request("POST", absenceURL(match), f.player, absenceBody(target)) }()
	waitManualLock(t, f, "SELECT ends_at,status FROM reservations%")
	if _, err := workerTx.Exec(f.ctx, `SELECT id FROM pending_matches WHERE id=$1::uuid FOR UPDATE`, match); err != nil {
		t.Fatal(err)
	}
	if _, err := workerTx.Exec(f.ctx, `UPDATE reservations SET status='cancelled' WHERE id=$1::uuid`, reservation); err != nil {
		t.Fatal(err)
	}
	if _, err := workerTx.Exec(f.ctx, `UPDATE pending_matches SET status='cancelled' WHERE id=$1::uuid`, match); err != nil {
		t.Fatal(err)
	}
	if err := workerTx.Commit(f.ctx); err != nil {
		t.Fatal(err)
	}
	if reply := <-replyCh; reply.err != nil || reply.status != 404 {
		t.Fatalf("cancelled match report reply=%+v", reply)
	}
}
