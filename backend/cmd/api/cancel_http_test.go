package main

import (
	"fmt"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/database"
)

const cancelTestSecret = "manual-reservation-http-tests-secret-32-bytes"
const unknownUUID = "00000000-0000-4000-8000-000000000099"

func (f *manualFixture) userID(t *testing.T, email string) string {
	t.Helper()
	var id string
	if err := f.db.QueryRow(f.ctx, `SELECT id::text FROM users WHERE email=$1`, email).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

// clockServer serves the same database with a fixed server clock.
func (f *manualFixture) clockServer(t *testing.T, now time.Time) *manualFixture {
	t.Helper()
	copy := *f
	copy.server = httptest.NewServer(newHandlerWithClock(f.db, []byte(cancelTestSecret), func() time.Time { return now }))
	t.Cleanup(copy.server.Close)
	return &copy
}

func (f *manualFixture) insertReservation(t *testing.T, origin, organizer string, starts, ends time.Time) string {
	t.Helper()
	var id string
	var err error
	if origin == "web" {
		err = f.db.QueryRow(f.ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,starts_at,ends_at,status,companions,contact_name,contact_phone,origin,registered_by)
			VALUES($1,$2,$3,$4,$5,'reserved',3,'Private client','555-PRIVATE','web',$3) RETURNING id::text`, f.complexID, f.courtID, organizer, starts, ends).Scan(&id)
	} else {
		err = f.db.QueryRow(f.ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,starts_at,ends_at,status,companions,contact_name,contact_phone,origin,registered_by)
			VALUES($1,$2,NULL,$3,$4,'reserved',NULL,'Private client','555-PRIVATE','manual',$5) RETURNING id::text`, f.complexID, f.courtID, starts, ends, f.managerID).Scan(&id)
	}
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func (f *manualFixture) count(t *testing.T, query string, args ...any) int {
	t.Helper()
	var n int
	if err := f.db.QueryRow(f.ctx, query, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func (f *manualFixture) managerCancelPath(complexID, reservationID string) string {
	return fmt.Sprintf("/api/v1/complexes/%s/reservations/%s/cancel", complexID, reservationID)
}

func slotTime(t *testing.T, f *manualFixture, hhmm string) time.Time {
	t.Helper()
	loc, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	v, err := time.ParseInLocation("2006-01-02 15:04", f.date+" "+hhmm, loc)
	if err != nil {
		t.Fatal(err)
	}
	return v
}

// TDD-0016 CA-01..08 (C2).
func TestHTTPCancelByManager(t *testing.T) {
	f := newManualFixture(t)
	playerEmail := "manual-player@example.com"
	playerID := f.userID(t, playerEmail)
	web := f.insertReservation(t, "web", playerID, slotTime(t, f, "18:00"), slotTime(t, f, "19:00"))
	manual := f.insertReservation(t, "manual", "", slotTime(t, f, "19:00"), slotTime(t, f, "20:00"))
	var otherComplex string
	if err := f.db.QueryRow(f.ctx, `INSERT INTO complexes(name,address,zone,phone) VALUES('Other','Street','Gonnet','123') RETURNING id::text`).Scan(&otherComplex); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name, token, path, body string
		status                  int
	}{
		{"no token", "", f.managerCancelPath(f.complexID, web), "", 401},
		{"invalid token", "invalid", f.managerCancelPath(f.complexID, web), "", 401},
		{"player", f.player, f.managerCancelPath(f.complexID, web), "", 403},
		{"other complex manager", f.manager, f.managerCancelPath(otherComplex, web), "", 403},
		{"unknown complex hidden", f.player, f.managerCancelPath(unknownUUID, web), "", 403},
		{"unknown complex admin", f.admin, f.managerCancelPath(unknownUUID, web), "", 404},
		{"unknown reservation", f.manager, f.managerCancelPath(f.complexID, unknownUUID), "", 404},
		{"reservation of another complex", f.admin, f.managerCancelPath(otherComplex, web), "", 404},
		{"bad reservation UUID", f.manager, f.managerCancelPath(f.complexID, "bad"), "", 400},
		{"bad complex UUID", f.manager, f.managerCancelPath("bad", web), "", 400},
		{"query", f.manager, f.managerCancelPath(f.complexID, web) + "?force=1", "", 400},
		{"body", f.manager, f.managerCancelPath(f.complexID, web), `{"x":1}`, 400},
	} {
		t.Run(tc.name, func(t *testing.T) {
			before := f.snapshot(t)
			expectManual(t, f.request("POST", tc.path, tc.token, tc.body), tc.status)
			if f.snapshot(t) != before {
				t.Fatal("rejected request modified stored data")
			}
		})
	}
	reply := f.request("POST", f.managerCancelPath(f.complexID, web), f.manager, "")
	data := expectManual(t, reply, 200)
	if reply.header.Get("Cache-Control") != "no-store" || !strings.Contains(string(data), `"status":"cancelled"`) || !strings.Contains(string(data), `"startsAt":"18:00"`) {
		t.Fatalf("response=%s header=%v", data, reply.header)
	}
	for _, secret := range []string{"Private client", "555-PRIVATE", "contact"} {
		if strings.Contains(string(data), secret) {
			t.Fatalf("response leaks %s: %s", secret, data)
		}
	}
	if f.count(t, `SELECT count(*) FROM reservation_notices WHERE reservation_id=$1 AND kind='reservation_cancelled' AND user_id=$2 AND NOT payload::text LIKE '%Private%'`, web, playerID) != 1 {
		t.Fatal("expected exactly one cancellation notice for the organizer")
	}
	notices := string(expectManual(t, f.request("GET", "/api/v1/reservation-notices", f.player, ""), 200))
	if !strings.Contains(notices, "reservation_cancelled") {
		t.Fatalf("notices=%s", notices)
	}
	list := string(expectManual(t, f.request("GET", "/api/v1/reservations?date="+f.date, f.player, ""), 200))
	if strings.Contains(list, web) {
		t.Fatalf("cancelled reservation still listed: %s", list)
	}
	before := f.snapshot(t)
	expectManual(t, f.request("POST", f.managerCancelPath(f.complexID, web), f.admin, ""), 200)
	if f.snapshot(t) != before {
		t.Fatal("idempotent repeat wrote data")
	}
	// The player's own endpoint is also idempotent after the manager cancelled.
	expectManual(t, f.request("POST", "/api/v1/reservations/"+web+"/cancel", f.player, ""), 200)
	if f.snapshot(t) != before {
		t.Fatal("player repeat wrote data")
	}
	notices = string(expectManual(t, f.request("GET", "/api/v1/reservation-notices", f.manager, ""), 200))
	expectManual(t, f.request("POST", f.managerCancelPath(f.complexID, manual), f.admin, ""), 200)
	if f.count(t, `SELECT count(*) FROM reservation_notices`) != 1 || f.count(t, `SELECT count(*) FROM reservations WHERE status='cancelled'`) != 2 {
		t.Fatal("manual cancellation must not create notices")
	}
	// Freed intervals can be booked again and show as available publicly.
	expectManual(t, f.request("POST", f.path("manual-reservations"), f.manager, f.body("18:00")), 201)
	slots := string(expectManual(t, f.request("GET", fmt.Sprintf("/api/v1/complexes/%s/slots?date=%s", f.complexID, f.date), "", ""), 200))
	if strings.Contains(slots, "Private client") || strings.Contains(slots, "555-PRIVATE") {
		t.Fatalf("slots leak contact: %s", slots)
	}
	_ = notices
}

// TDD-0010 CA-01..10 (C3).
func TestHTTPCancelOwnWindow(t *testing.T) {
	f := newManualFixture(t)
	playerID := f.userID(t, "manual-player@example.com")
	own := func(id string) string { return "/api/v1/reservations/" + id + "/cancel" }
	s1, s2, s3 := slotTime(t, f, "18:00"), slotTime(t, f, "19:00"), slotTime(t, f, "20:00")
	r1 := f.insertReservation(t, "web", playerID, s1, s1.Add(time.Hour))
	r2 := f.insertReservation(t, "web", playerID, s2, s2.Add(time.Hour))
	r3 := f.insertReservation(t, "web", playerID, s3, s3.Add(time.Hour))
	manual := f.insertReservation(t, "manual", "", slotTime(t, f, "21:00"), slotTime(t, f, "22:00"))
	for _, tc := range []struct {
		name, token, path, body string
		status                  int
	}{
		{"no token", "", own(r1), "", 401},
		{"not organizer", f.manager, own(r1), "", 404},
		{"manual reservation", f.manager, own(manual), "", 404},
		{"manual reservation admin", f.admin, own(manual), "", 404},
		{"unknown", f.player, own(unknownUUID), "", 404},
		{"bad UUID", f.player, own("bad"), "", 400},
		{"query", f.player, own(r1) + "?a=1", "", 400},
		{"body", f.player, own(r1), "{}", 400},
	} {
		t.Run(tc.name, func(t *testing.T) {
			before := f.snapshot(t)
			expectManual(t, f.request("POST", tc.path, tc.token, tc.body), tc.status)
			if f.snapshot(t) != before {
				t.Fatal("rejected request modified stored data")
			}
		})
	}
	late := f.clockServer(t, s3.Add(-4*time.Hour+time.Nanosecond))
	before := f.snapshot(t)
	expectManual(t, late.request("POST", own(r3), f.player, ""), 409)
	if f.snapshot(t) != before {
		t.Fatal("late cancellation wrote data")
	}
	exact := f.clockServer(t, s1.Add(-4*time.Hour))
	data := expectManual(t, exact.request("POST", own(r1), f.player, ""), 200)
	if !strings.Contains(string(data), `"cancelled"`) || strings.Contains(string(data), "Private") {
		t.Fatalf("response=%s", data)
	}
	early := f.clockServer(t, s2.Add(-4*time.Hour-time.Nanosecond))
	expectManual(t, early.request("POST", own(r2), f.player, ""), 200)
	if f.count(t, `SELECT count(*) FROM reservation_notices WHERE kind='reservation_cancelled'`) != 2 {
		t.Fatal("expected one notice per cancellation")
	}
	// Repeat after the window still answers 200 without writes.
	before = f.snapshot(t)
	expectManual(t, late.request("POST", own(r1), f.player, ""), 200)
	if f.snapshot(t) != before {
		t.Fatal("repeat wrote data")
	}
	list := string(expectManual(t, f.request("GET", "/api/v1/reservations?date="+f.date, f.player, ""), 200))
	if strings.Contains(list, r1) || strings.Contains(list, r2) || !strings.Contains(list, r3) {
		t.Fatalf("own list=%s", list)
	}
}

func TestHTTPCancelManagerFinishedReservation(t *testing.T) {
	f := newManualFixture(t)
	playerID := f.userID(t, "manual-player@example.com")
	end := slotTime(t, f, "19:00")
	exact := f.insertReservation(t, "web", playerID, end.Add(-time.Hour), end)
	future := f.insertReservation(t, "manual", "", end, end.Add(time.Hour))
	atEnd := f.clockServer(t, end)
	before := f.snapshot(t)
	data := expectManual(t, atEnd.request("POST", f.managerCancelPath(f.complexID, exact), f.manager, ""), 409)
	if !strings.Contains(string(data), "ya finalizó") || f.snapshot(t) != before {
		t.Fatalf("finished: %s", data)
	}
	// Ten minutes before it ends it is still cancellable, even inside the 4 hour player window.
	running := f.clockServer(t, end.Add(-10*time.Minute))
	expectManual(t, running.request("POST", f.managerCancelPath(f.complexID, exact), f.manager, ""), 200)
	expectManual(t, running.request("POST", f.managerCancelPath(f.complexID, future), f.manager, ""), 200)
}

func TestHTTPCancelAtomicityAndConcurrency(t *testing.T) {
	t.Run("notice failure rolls back", func(t *testing.T) {
		f := newManualFixture(t)
		id := f.insertReservation(t, "web", f.userID(t, "manual-player@example.com"), slotTime(t, f, "18:00"), slotTime(t, f, "19:00"))
		if _, err := f.db.Exec(f.ctx, `ALTER TABLE reservation_notices ADD CHECK (kind <> 'reservation_cancelled')`); err != nil {
			t.Fatal(err)
		}
		before := f.snapshot(t)
		expectManual(t, f.request("POST", f.managerCancelPath(f.complexID, id), f.manager, ""), 500)
		if f.snapshot(t) != before {
			t.Fatal("failed notice left partial changes")
		}
	})
	t.Run("two cancellations", func(t *testing.T) {
		f := newManualFixture(t)
		id := f.insertReservation(t, "web", f.userID(t, "manual-player@example.com"), slotTime(t, f, "18:00"), slotTime(t, f, "19:00"))
		var wg sync.WaitGroup
		statuses := make([]int, 4)
		for i := range statuses {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				if i%2 == 0 {
					statuses[i] = f.request("POST", f.managerCancelPath(f.complexID, id), f.manager, "").status
				} else {
					statuses[i] = f.request("POST", "/api/v1/reservations/"+id+"/cancel", f.player, "").status
				}
			}(i)
		}
		wg.Wait()
		for _, s := range statuses {
			if s != 200 {
				t.Fatalf("statuses=%v", statuses)
			}
		}
		if f.count(t, `SELECT count(*) FROM reservation_notices`) != 1 {
			t.Fatal("expected a single notice")
		}
	})
	for _, first := range []string{"cancel", "create"} {
		t.Run("cancel vs create/"+first+" first", func(t *testing.T) {
			f := newManualFixture(t)
			id := f.insertReservation(t, "web", f.userID(t, "manual-player@example.com"), slotTime(t, f, "18:00"), slotTime(t, f, "19:00"))
			blocker, err := f.db.Begin(f.ctx)
			if err != nil {
				t.Fatal(err)
			}
			defer blocker.Rollback(f.ctx)
			if _, err := blocker.Exec(f.ctx, `SELECT id FROM courts WHERE id=$1 FOR UPDATE`, f.courtID); err != nil {
				t.Fatal(err)
			}
			cancelRes, createRes := make(chan manualReply, 1), make(chan manualReply, 1)
			runCancel := func() {
				go func() { cancelRes <- f.request("POST", f.managerCancelPath(f.complexID, id), f.manager, "") }()
			}
			runCreate := func() {
				go func() { createRes <- f.request("POST", f.path("manual-reservations"), f.manager, f.body("18:00")) }()
			}
			if first == "cancel" {
				runCancel()
				waitCourtWaiters(t, f, 1)
				runCreate()
			} else {
				runCreate()
				waitCourtWaiters(t, f, 1)
				runCancel()
			}
			waitCourtWaiters(t, f, 2)
			if err := blocker.Commit(f.ctx); err != nil {
				t.Fatal(err)
			}
			c, n := <-cancelRes, <-createRes
			expectManual(t, c, 200)
			wantCreate, wantActive := 201, 1
			if first == "create" {
				wantCreate, wantActive = 409, 0
			}
			expectManual(t, n, wantCreate)
			if f.count(t, `SELECT count(*) FROM reservations WHERE status='reserved'`) != wantActive {
				t.Fatalf("active reservations != %d", wantActive)
			}
		})
	}
}

func waitCourtWaiters(t *testing.T, f *manualFixture, want int) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		var n int
		err := f.db.QueryRow(f.ctx, `SELECT count(*) FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%FROM courts%FOR UPDATE%'`,
			f.db.Config().ConnConfig.RuntimeParams["application_name"]).Scan(&n)
		if err != nil {
			t.Fatal(err)
		}
		if n >= want {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("expected %d court lock waiters", want)
}

// Migration 006 must apply over a database already migrated to 007 and keep notices.
func TestCancellationNoticeMigrationOverMigratedDatabase(t *testing.T) {
	f := newManualFixture(t)
	id := f.insertReservation(t, "web", f.userID(t, "manual-player@example.com"), slotTime(t, f, "18:00"), slotTime(t, f, "19:00"))
	for _, stmt := range []string{
		`ALTER TABLE reservation_notices DROP CONSTRAINT reservation_notices_kind_check`,
		`ALTER TABLE reservation_notices ADD CONSTRAINT reservation_notices_kind_check CHECK (kind = 'reservation_confirmed')`,
		`DELETE FROM schema_migrations WHERE version='006_reservation_cancellation_notice.sql'`,
	} {
		if _, err := f.db.Exec(f.ctx, stmt); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := f.db.Exec(f.ctx, `INSERT INTO reservation_notices(user_id,reservation_id,kind,payload) VALUES($1,$2,'reservation_confirmed','{"kept":true}')`, f.managerID, id); err != nil {
		t.Fatal(err)
	}
	if _, err := f.db.Exec(f.ctx, `INSERT INTO reservation_notices(user_id,reservation_id,kind,payload) VALUES($1,$2,'reservation_cancelled','{}')`, f.managerID, id); err == nil {
		t.Fatal("old constraint should reject the new kind")
	}
	if err := database.Migrate(f.ctx, f.db); err != nil {
		t.Fatal(err)
	}
	if f.count(t, `SELECT count(*) FROM reservation_notices WHERE kind='reservation_confirmed' AND payload='{"kept":true}'`) != 1 {
		t.Fatal("migration changed existing notices")
	}
	if _, err := f.db.Exec(f.ctx, `INSERT INTO reservation_notices(user_id,reservation_id,kind,payload) VALUES($1,$2,'reservation_cancelled','{}')`, f.managerID, id); err != nil {
		t.Fatalf("new kind rejected: %v", err)
	}
	if _, err := f.db.Exec(f.ctx, `INSERT INTO reservation_notices(user_id,reservation_id,kind,payload) VALUES($1,$2,'other','{}')`, f.managerID, id); err == nil {
		t.Fatal("unknown kind accepted")
	}
	if err := database.Migrate(f.ctx, f.db); err != nil {
		t.Fatalf("second migration: %v", err)
	}
}
