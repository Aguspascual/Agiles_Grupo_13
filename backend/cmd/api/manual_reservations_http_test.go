package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/database"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/reservations"
	"github.com/aguspascual/agiles_grupo_13/backend/migrations"
	"github.com/jackc/pgx/v5/pgxpool"
)

type manualFixture struct {
	db                                         *pgxpool.Pool
	ctx                                        context.Context
	server                                     *httptest.Server
	complexID, courtID, dayID, date            string
	managerID, manager, adminID, admin, player string
}

type manualReply struct {
	status int
	body   []byte
	header http.Header
	err    error
}

func (f *manualFixture) request(method, path, token, body string) manualReply {
	req, err := http.NewRequest(method, f.server.URL+path, strings.NewReader(body))
	if err != nil {
		return manualReply{err: err}
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := f.server.Client().Do(req)
	if err != nil {
		return manualReply{err: err}
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	return manualReply{resp.StatusCode, data, resp.Header, err}
}

func expectManual(t *testing.T, reply manualReply, status int) []byte {
	t.Helper()
	if reply.err != nil || reply.status != status {
		t.Fatalf("HTTP status=%d want=%d err=%v body=%s", reply.status, status, reply.err, reply.body)
	}
	return reply.body
}

func newManualFixture(t *testing.T) *manualFixture {
	t.Helper()
	db, ctx := httpTestPool(t)
	cfg := db.Config()
	cfg.ConnConfig.RuntimeParams["application_name"] = "manual_" + cfg.ConnConfig.RuntimeParams["search_path"]
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	f := &manualFixture{db: db, ctx: ctx, server: httptest.NewServer(newHandler(db, []byte("manual-reservation-http-tests-secret-32-bytes")))}
	f.server.Client().Timeout = 15 * time.Second
	t.Cleanup(f.server.Close)
	register := func(email string) (string, string) {
		body := fmt.Sprintf(`{"name":"Test","email":%q,"password":"TestPassword-123!","zone":"Gonnet","level":"7ma","fairPlay":true}`, email)
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
	f.managerID, f.manager = register("manual-manager@example.com")
	f.adminID, f.admin = register("manual-admin@example.com")
	_, f.player = register("manual-player@example.com")
	if _, err := db.Exec(ctx, `UPDATE users SET role='ADMIN' WHERE id=$1`, f.adminID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO complexes(name,address,zone,phone) VALUES('Manual club','Street','Gonnet','123') RETURNING id::text`).Scan(&f.complexID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO complex_managers(complex_id,user_id) VALUES($1,$2)`, f.complexID, f.managerID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO courts(complex_id,name,covered) VALUES($1,'Court',false) RETURNING id::text`, f.complexID).Scan(&f.courtID); err != nil {
		t.Fatal(err)
	}
	loc, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	date := time.Now().In(loc).AddDate(0, 0, 2)
	f.date = date.Format("2006-01-02")
	weekday := (int(date.Weekday())+6)%7 + 1
	if err := db.QueryRow(ctx, `INSERT INTO court_schedule_days(court_id,weekday,enabled,duration_minutes) VALUES($1,$2,true,60) RETURNING id::text`, f.courtID, weekday).Scan(&f.dayID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO court_schedule_intervals(schedule_day_id,opens_at,closes_at) VALUES($1,'18:00','23:00')`, f.dayID); err != nil {
		t.Fatal(err)
	}
	return f
}

func (f *manualFixture) path(suffix string) string {
	return fmt.Sprintf("/api/v1/complexes/%s/courts/%s/%s", f.complexID, f.courtID, suffix)
}
func (f *manualFixture) body(start string) string {
	return fmt.Sprintf(`{"date":%q,"startsAt":%q,"contact":{"name":" Private client ","phone":" 555-PRIVATE "}}`, f.date, start)
}
func (f *manualFixture) snapshot(t *testing.T) string {
	t.Helper()
	var snapshot string
	err := f.db.QueryRow(f.ctx, `SELECT concat(
		(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id)::text,'[]') FROM reservations r),
		(SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.id)::text,'[]') FROM reservation_notices n),
		(SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.id)::text,'[]') FROM users u))`).Scan(&snapshot)
	if err != nil {
		t.Fatal(err)
	}
	return snapshot
}

// TDD-0012 CA-01..08: identity, privacy, persistence, validation and web regression.
func TestHTTPManualReservations(t *testing.T) {
	f := newManualFixture(t)
	manual := f.path("manual-reservations")
	created := expectManual(t, f.request("POST", manual, f.manager, f.body("18:00")), 201)
	var result struct{ Reservation reservations.Reservation }
	if err := json.Unmarshal(created, &result); err != nil {
		t.Fatal(err)
	}
	if result.Reservation.ID == "" || result.Reservation.Status != "reserved" || result.Reservation.StartsAt != "18:00" || result.Reservation.EndsAt != "19:00" || result.Reservation.TimeZone != "America/Argentina/Buenos_Aires" {
		t.Fatalf("reservation=%s", created)
	}
	var valid bool
	if err := f.db.QueryRow(f.ctx, `SELECT origin='manual' AND registered_by=$2::uuid AND organizer_id IS NULL AND companions IS NULL AND contact_name='Private client' AND contact_phone='555-PRIVATE' AND ends_at-starts_at=interval '60 minutes' FROM reservations WHERE id=$1`, result.Reservation.ID, f.managerID).Scan(&valid); err != nil || !valid {
		t.Fatalf("persisted identity/contact=%v err=%v", valid, err)
	}
	expectManual(t, f.request("POST", manual, f.admin, f.body("19:00")), 201)
	expectManual(t, f.request("POST", f.path("reservations"), f.manager, f.body("20:00")), 201)
	for _, query := range []string{"SELECT count(*)=3 FROM users", "SELECT count(*)=1 FROM reservation_notices", "SELECT count(*)=1 FROM reservations WHERE origin='web' AND organizer_id=registered_by AND companions=3"} {
		if err := f.db.QueryRow(f.ctx, query).Scan(&valid); err != nil || !valid {
			t.Fatalf("%s: valid=%v err=%v", query, valid, err)
		}
	}
	for _, endpoint := range []string{"reservations?date=" + f.date, "reservation-notices"} {
		data := expectManual(t, f.request("GET", "/api/v1/"+endpoint, f.manager, ""), 200)
		if strings.Contains(string(data), result.Reservation.ID) || strings.Contains(string(data), "Private client") || !strings.Contains(string(data), `"20:00"`) {
			t.Fatalf("manual leaked or web disappeared: %s", data)
		}
	}
	assertPrivate := func(data []byte) {
		t.Helper()
		for _, secret := range []string{"Private client", "555-PRIVATE", result.Reservation.ID, f.managerID, `"contact"`, `"organizer"`, `"registeredBy"`} {
			if strings.Contains(string(data), secret) {
				t.Fatalf("public response contains %s: %s", secret, data)
			}
		}
		if !strings.Contains(string(data), `"RESERVED"`) {
			t.Fatalf("manual occupancy missing: %s", data)
		}
	}
	availability := fmt.Sprintf("/api/v1/complexes/%s/slots?date=%s", f.complexID, f.date)
	assertPrivate(expectManual(t, f.request("GET", availability, "", ""), 200))
	var otherComplex string
	if err := f.db.QueryRow(f.ctx, `INSERT INTO complexes(name,address,zone,phone) VALUES('Other','Street','Gonnet','123') RETURNING id::text`).Scan(&otherComplex); err != nil {
		t.Fatal(err)
	}
	unknown := "00000000-0000-4000-8000-000000000099"
	dateValue, err := time.Parse("2006-01-02", f.date)
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name, token, path, body string
		status                  int
	}{
		{"no token", "", manual, f.body("21:00"), 401},
		{"invalid token", "invalid", manual, f.body("21:00"), 401},
		{"player", f.player, manual, f.body("21:00"), 403},
		{"other complex", f.manager, strings.Replace(manual, f.complexID, otherComplex, 1), f.body("21:00"), 403},
		{"unknown complex private", f.player, strings.Replace(manual, f.complexID, unknown, 1), f.body("21:00"), 403},
		{"missing complex admin", f.admin, strings.Replace(manual, f.complexID, unknown, 1), f.body("21:00"), 404},
		{"missing court", f.manager, strings.Replace(manual, f.courtID, unknown, 1), f.body("21:00"), 404},
		{"wrong court complex", f.admin, strings.Replace(manual, f.complexID, otherComplex, 1), f.body("21:00"), 404},
		{"bad UUID", f.manager, strings.Replace(manual, f.courtID, "bad", 1), f.body("21:00"), 400},
		{"query", f.manager, manual + "?origin=web", f.body("21:00"), 400},
		{"extra identity", f.manager, manual, strings.Replace(f.body("21:00"), `"date":`, `"organizerId":"fake","date":`, 1), 400},
		{"empty name", f.manager, manual, strings.Replace(f.body("21:00"), " Private client ", " ", 1), 400},
		{"empty phone", f.manager, manual, strings.Replace(f.body("21:00"), " 555-PRIVATE ", " ", 1), 400},
		{"missing contact", f.manager, manual, fmt.Sprintf(`{"date":%q,"startsAt":"21:00"}`, f.date), 400},
		{"bad date", f.manager, manual, strings.Replace(f.body("21:00"), f.date, "2026-02-30", 1), 400},
		{"malformed JSON", f.manager, manual, "{", 400},
		{"past", f.manager, manual, strings.Replace(f.body("21:00"), f.date, "2000-01-01", 1), 409},
		{"no schedule", f.manager, manual, strings.Replace(f.body("21:00"), f.date, dateValue.AddDate(0, 0, 1).Format("2006-01-02"), 1), 409},
		{"unaligned", f.manager, manual, f.body("21:30"), 409},
		{"outside", f.manager, manual, f.body("23:00"), 409},
		{"occupied", f.manager, manual, f.body("18:00"), 409},
	} {
		t.Run(tc.name, func(t *testing.T) {
			before := f.snapshot(t)
			reply := f.request("POST", tc.path, tc.token, tc.body)
			expectManual(t, reply, tc.status)
			if f.snapshot(t) != before {
				t.Fatal("rejected request modified stored data")
			}
		})
	}
	if _, err := f.db.Exec(f.ctx, `UPDATE court_schedule_days SET enabled=false,duration_minutes=90 WHERE id=$1`, f.dayID); err != nil {
		t.Fatal(err)
	}
	expectManual(t, f.request("POST", manual, f.manager, f.body("21:00")), 409)
	assertPrivate(expectManual(t, f.request("GET", availability, "", ""), 200))
	if err := f.db.QueryRow(f.ctx, `SELECT ends_at-starts_at=interval '60 minutes' FROM reservations WHERE id=$1`, result.Reservation.ID).Scan(&valid); err != nil || !valid {
		t.Fatalf("historical duration changed: %v %v", valid, err)
	}
	if _, err := f.db.Exec(f.ctx, `UPDATE court_schedule_days SET enabled=true WHERE id=$1`, f.dayID); err != nil {
		t.Fatal(err)
	}
	before := f.snapshot(t)
	// The 90-minute candidate partially overlaps the existing 20:00 web reservation.
	expectManual(t, f.request("POST", manual, f.manager, f.body("19:30")), 409)
	if f.snapshot(t) != before {
		t.Fatal("overlap after duration change modified data")
	}
	// 21:00 is actually adjacent to the old 20:00-21:00 interval and must be accepted.
	expectManual(t, f.request("POST", manual, f.manager, f.body("21:00")), 201)
}

func TestHTTPManualReservationRaces(t *testing.T) {
	for _, second := range []string{"manual-reservations", "reservations"} {
		t.Run(second, func(t *testing.T) {
			f := newManualFixture(t)
			start := make(chan struct{})
			results := make(chan manualReply, 2)
			for _, suffix := range []string{"manual-reservations", second} {
				go func(path string) { <-start; results <- f.request("POST", path, f.manager, f.body("18:00")) }(f.path(suffix))
			}
			close(start)
			counts := map[int]int{}
			for i := 0; i < 2; i++ {
				r := <-results
				if r.err != nil {
					t.Fatal(r.err)
				}
				counts[r.status]++
			}
			if counts[201] != 1 || counts[409] != 1 {
				t.Fatalf("race=%v", counts)
			}
			var valid bool
			if err := f.db.QueryRow(f.ctx, `SELECT (SELECT count(*) FROM reservations)=1 AND (SELECT count(*) FROM reservation_notices)=(SELECT count(*) FROM reservations WHERE origin='web')`).Scan(&valid); err != nil || !valid {
				t.Fatalf("race persistence=%v %v", valid, err)
			}
		})
	}
}

// Exercise the actual runner over pre-007 rows, including cancelled reservations and notices.
func TestManualReservationMigrationPreservesWebData(t *testing.T) {
	f := newManualFixture(t)
	if _, err := f.db.Exec(f.ctx, `DROP TABLE reservation_notices; DROP TABLE reservations; DELETE FROM schema_migrations WHERE version='007_manual_reservations.sql'`); err != nil {
		t.Fatal(err)
	}
	old, err := migrations.Files.ReadFile("005_reservations.sql")
	if err != nil {
		t.Fatal(err)
	}
	for _, statement := range strings.Split(string(old), ";") {
		if strings.TrimSpace(statement) != "" {
			if _, err := f.db.Exec(f.ctx, statement); err != nil {
				t.Fatal(err)
			}
		}
	}
	for _, status := range []string{"reserved", "cancelled"} {
		var id string
		err := f.db.QueryRow(f.ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,starts_at,ends_at,status,companions,contact_name,contact_phone) VALUES($1,$2,$3,now()+interval '2 days',now()+interval '2 days 1 hour',$4,3,'Historical','123') RETURNING id::text`, f.complexID, f.courtID, f.managerID, status).Scan(&id)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := f.db.Exec(f.ctx, `INSERT INTO reservation_notices(user_id,reservation_id,kind,payload) VALUES($1,$2,'reservation_confirmed','{"historical":true}')`, f.managerID, id); err != nil {
			t.Fatal(err)
		}
	}
	var before, after string
	// Exclude only the two new fields when comparing the historical bytes.
	snapshot := `SELECT concat((SELECT jsonb_agg(to_jsonb(r)-'origin'-'registered_by' ORDER BY r.id)::text FROM reservations r),(SELECT jsonb_agg(to_jsonb(n) ORDER BY n.id)::text FROM reservation_notices n))`
	if err := f.db.QueryRow(f.ctx, snapshot).Scan(&before); err != nil {
		t.Fatal(err)
	}
	if err := database.Migrate(f.ctx, f.db); err != nil {
		t.Fatal(err)
	}
	if err := f.db.QueryRow(f.ctx, snapshot).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if before != after {
		t.Fatal("migration changed historical reservations or notices")
	}
	var valid bool
	if err := f.db.QueryRow(f.ctx, `SELECT bool_and(origin='web' AND registered_by=organizer_id) FROM reservations`).Scan(&valid); err != nil || !valid {
		t.Fatalf("backfill=%v err=%v", valid, err)
	}
	if err := database.Migrate(f.ctx, f.db); err != nil {
		t.Fatalf("second migration=%v", err)
	}
	for _, bad := range []string{
		`UPDATE reservations SET origin='manual'`,
		`UPDATE reservations SET organizer_id=NULL`,
		`UPDATE reservations SET companions=NULL`,
		`UPDATE reservations SET origin='unknown'`,
		`UPDATE reservations SET registered_by=NULL`,
		fmt.Sprintf(`UPDATE reservations SET registered_by='%s'`, f.adminID),
		`UPDATE reservations SET registered_by='00000000-0000-4000-8000-000000000099'`,
	} {
		if _, err := f.db.Exec(f.ctx, bad); err == nil {
			t.Fatalf("invalid identity accepted: %s", bad)
		}
	}
}

func TestHTTPManualReservationRollback(t *testing.T) {
	f := newManualFixture(t)
	if _, err := f.db.Exec(f.ctx, `ALTER TABLE reservations ADD CHECK (contact_name <> 'Private client')`); err != nil {
		t.Fatal(err)
	}
	before := f.snapshot(t)
	expectManual(t, f.request("POST", f.path("manual-reservations"), f.manager, f.body("18:00")), 500)
	if f.snapshot(t) != before {
		t.Fatal("failed insertion changed data")
	}
}

func waitManualLock(t *testing.T, f *manualFixture, query string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		var waiting bool
		err := f.db.QueryRow(f.ctx, `SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE $2)`, f.db.Config().ConnConfig.RuntimeParams["application_name"], query).Scan(&waiting)
		if err != nil {
			t.Fatal(err)
		}
		if waiting {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("request never waited on %s", query)
}

// Authorization must be current after lock waits, not captured by middleware earlier.
func TestHTTPManualReservationPermissionRevocation(t *testing.T) {
	for _, kind := range []string{"assignment", "admin role"} {
		t.Run(kind, func(t *testing.T) {
			f := newManualFixture(t)
			blocker, err := f.db.Begin(f.ctx)
			if err != nil {
				t.Fatal(err)
			}
			defer blocker.Rollback(f.ctx)
			if _, err := blocker.Exec(f.ctx, `SELECT id FROM complexes WHERE id=$1 FOR UPDATE`, f.complexID); err != nil {
				t.Fatal(err)
			}
			token := f.manager
			if kind == "admin role" {
				token = f.admin
			}
			result := make(chan manualReply, 1)
			go func() { result <- f.request("POST", f.path("manual-reservations"), token, f.body("18:00")) }()
			waitManualLock(t, f, "%SELECT name FROM complexes%FOR SHARE%")
			if kind == "assignment" {
				_, err = blocker.Exec(f.ctx, `DELETE FROM complex_managers WHERE complex_id=$1 AND user_id=$2`, f.complexID, f.managerID)
			} else {
				_, err = blocker.Exec(f.ctx, `UPDATE users SET role='USER' WHERE id=$1`, f.adminID)
			}
			if err != nil {
				t.Fatal(err)
			}
			if err := blocker.Commit(f.ctx); err != nil {
				t.Fatal(err)
			}
			before := f.snapshot(t)
			expectManual(t, <-result, 403)
			if f.snapshot(t) != before {
				t.Fatal("revoked permission still wrote data")
			}
		})
	}
}
