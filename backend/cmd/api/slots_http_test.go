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

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/slots"
)

// TDD-0009 CA-01..CA-15: public availability uses a consistent PostgreSQL snapshot.
func TestHTTPPostgresHU05AvailabilityAndMidnightProjection(t *testing.T) {
	db, ctx := httpTestPool(t)
	secret := []byte("only-for-http-integration-tests-at-least-32-bytes")
	location, err := time.LoadLocation(slots.TimeZone)
	if err != nil {
		t.Fatal(err)
	}
	testClock := func() time.Time { return time.Date(2026, 10, 29, 12, 0, 0, 0, location) }
	server := httptest.NewServer(newHandlerWithClock(db, secret, testClock))
	defer server.Close()
	client := server.Client()
	client.Timeout = 10 * time.Second

	registerBody := `{"name":"Availability test","email":"availability@example.com","password":"TestPassword-123!","zone":"Gonnet","level":"7ma","fairPlay":true}`
	register, err := http.NewRequest(http.MethodPost, server.URL+"/api/v1/auth/register", strings.NewReader(registerBody))
	if err != nil {
		t.Fatal(err)
	}
	register.Header.Set("Content-Type", "application/json")
	registerResponse, err := client.Do(register)
	if err != nil {
		t.Fatal(err)
	}
	registerData, err := io.ReadAll(registerResponse.Body)
	registerResponse.Body.Close()
	if err != nil || registerResponse.StatusCode != http.StatusCreated {
		t.Fatalf("register status=%d err=%v body=%s", registerResponse.StatusCode, err, registerData)
	}
	var registered struct {
		User auth.User `json:"user"`
	}
	if err := json.Unmarshal(registerData, &registered); err != nil {
		t.Fatal(err)
	}

	var complexID, gridCourtID, overnightCourtID, changedDurationCourtID, inactiveCourtID string
	if err := db.QueryRow(ctx, `INSERT INTO complexes(name,address,zone,phone) VALUES('HU05 real','Calle 1','Gonnet','555') RETURNING id::text`).Scan(&complexID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO courts(complex_id,name,covered) VALUES($1::uuid,'Cancha 1',true) RETURNING id::text`, complexID).Scan(&gridCourtID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO courts(complex_id,name,covered) VALUES($1::uuid,'Cancha 2',false) RETURNING id::text`, complexID).Scan(&overnightCourtID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO courts(complex_id,name,covered) VALUES($1::uuid,'Cancha 3',false) RETURNING id::text`, complexID).Scan(&changedDurationCourtID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO courts(complex_id,name,covered,deleted_at) VALUES($1::uuid,'Cancha 0 inactiva',false,now()) RETURNING id::text`, complexID).Scan(&inactiveCourtID); err != nil {
		t.Fatal(err)
	}
	var scheduleDayID string
	if err := db.QueryRow(ctx, `INSERT INTO court_schedule_days(court_id,weekday,enabled,duration_minutes) VALUES($1::uuid,5,true,60) RETURNING id::text`, gridCourtID).Scan(&scheduleDayID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO court_schedule_intervals(schedule_day_id,opens_at,closes_at) VALUES($1::uuid,'18:00','21:00')`, scheduleDayID); err != nil {
		t.Fatal(err)
	}
	var changedDurationScheduleID string
	if err := db.QueryRow(ctx, `INSERT INTO court_schedule_days(court_id,weekday,enabled,duration_minutes) VALUES($1::uuid,5,true,90) RETURNING id::text`, changedDurationCourtID).Scan(&changedDurationScheduleID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO court_schedule_intervals(schedule_day_id,opens_at,closes_at) VALUES($1::uuid,'18:00','21:00')`, changedDurationScheduleID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,registered_by,starts_at,ends_at,status,companions,contact_name,contact_phone)
		VALUES($1::uuid,$2::uuid,$3::uuid,$3::uuid,'2026-10-30 18:30:00-03','2026-10-30 20:00:00-03','reserved',3,'PRIVATE CONTACT','555-PRIVATE')`, complexID, gridCourtID, registered.User.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,registered_by,starts_at,ends_at,status,companions,contact_name,contact_phone)
		VALUES($1::uuid,$2::uuid,$3::uuid,$3::uuid,'2026-10-30 23:30:00-03','2026-10-31 01:00:00-03','reserved',3,'PRIVATE CONTACT','555-PRIVATE')`, complexID, overnightCourtID, registered.User.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,registered_by,starts_at,ends_at,status,companions,contact_name,contact_phone)
		VALUES($1::uuid,$2::uuid,$3::uuid,$3::uuid,'2026-10-30 19:00:00-03','2026-10-30 20:00:00-03','reserved',3,'PRIVATE CONTACT','555-PRIVATE')`, complexID, changedDurationCourtID, registered.User.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,registered_by,starts_at,ends_at,status,companions,contact_name,contact_phone)
		VALUES($1::uuid,$2::uuid,$3::uuid,$3::uuid,'2026-10-30 18:00:00-03','2026-10-30 19:00:00-03','reserved',3,'PRIVATE CONTACT','555-PRIVATE')`, complexID, inactiveCourtID, registered.User.ID); err != nil {
		t.Fatal(err)
	}
	var disabledScheduleID string
	if err := db.QueryRow(ctx, `INSERT INTO court_schedule_days(court_id,weekday,enabled,duration_minutes) VALUES($1::uuid,6,false,60) RETURNING id::text`, gridCourtID).Scan(&disabledScheduleID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO court_schedule_intervals(schedule_day_id,opens_at,closes_at) VALUES($1::uuid,'09:00','12:00')`, disabledScheduleID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,registered_by,starts_at,ends_at,status,companions,contact_name,contact_phone)
		VALUES($1::uuid,$2::uuid,$3::uuid,$3::uuid,'2026-10-31 09:30:00-03','2026-10-31 10:30:00-03','reserved',3,'PRIVATE CONTACT','555-PRIVATE')`, complexID, gridCourtID, registered.User.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,registered_by,starts_at,ends_at,status,companions,contact_name,contact_phone)
		VALUES($1::uuid,$2::uuid,$3::uuid,$3::uuid,'2026-10-31 11:00:00-03','2026-10-31 12:00:00-03','cancelled',3,'PRIVATE CONTACT','555-PRIVATE')`, complexID, gridCourtID, registered.User.ID); err != nil {
		t.Fatal(err)
	}

	request := func(date string) ([]byte, http.Header) {
		t.Helper()
		response, err := client.Get(fmt.Sprintf("%s/api/v1/complexes/%s/slots?date=%s", server.URL, complexID, date))
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		data, err := io.ReadAll(response.Body)
		if err != nil {
			t.Fatal(err)
		}
		if response.StatusCode != http.StatusOK {
			t.Fatalf("GET date=%s status=%d body=%s", date, response.StatusCode, data)
		}
		if response.Header.Get("Cache-Control") != "no-store" {
			t.Errorf("Cache-Control=%q", response.Header.Get("Cache-Control"))
		}
		if strings.Contains(string(data), "PRIVATE CONTACT") || strings.Contains(string(data), "555-PRIVATE") {
			t.Fatal("availability response exposed reservation contact data")
		}
		return data, response.Header
	}
	statusRequest := func(path string, want int) {
		t.Helper()
		response, err := client.Get(server.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		body, err := io.ReadAll(response.Body)
		if err != nil || response.StatusCode != want {
			t.Fatalf("GET %s status=%d want=%d err=%v body=%s", path, response.StatusCode, want, err, body)
		}
	}
	statusRequest("/api/v1/complexes/"+complexID+"/slots", http.StatusBadRequest)
	statusRequest("/api/v1/complexes/"+complexID+"/slots?date=2026-02-30", http.StatusBadRequest)
	statusRequest("/api/v1/complexes/"+complexID+"/slots?date=2026-10-30&unexpected=true", http.StatusBadRequest)
	statusRequest("/api/v1/complexes/not-a-uuid/slots?date=2026-10-30", http.StatusBadRequest)

	data, _ := request("2026-10-30")
	var friday slots.Response
	if err := json.Unmarshal(data, &friday); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(data), inactiveCourtID) {
		t.Fatal("availability response included an inactive court")
	}
	if len(friday.Courts) != 3 || friday.Courts[0].Name != "Cancha 1" || friday.Courts[1].Name != "Cancha 2" || friday.Courts[2].Name != "Cancha 3" {
		t.Fatalf("courts ordering/content=%+v", friday.Courts)
	}
	grid := friday.Courts[0]
	if len(grid.Slots) != 3 || grid.Slots[0].Status != "RESERVED" || grid.Slots[1].Status != "RESERVED" || grid.Slots[2].Status != "AVAILABLE" {
		t.Fatalf("60-minute grid=%+v", grid.Slots)
	}
	if len(grid.OccupiedIntervals) != 1 || grid.OccupiedIntervals[0].OriginalStartsAt != "2026-10-30T18:30:00-03:00" || grid.OccupiedIntervals[0].OriginalEndsAt != "2026-10-30T20:00:00-03:00" {
		t.Fatalf("persisted occupancy=%+v", grid.OccupiedIntervals)
	}
	if grid.Slots[0].StartsAt != "18:00" || grid.Slots[0].EndsAt != "19:00" || grid.Slots[1].StartsAt != "19:00" || grid.Slots[1].EndsAt != "20:00" || grid.Slots[2].StartsAt != "20:00" || grid.Slots[2].EndsAt != "21:00" {
		t.Fatalf("unexpected slots=%+v", grid.Slots)
	}
	changedDuration := friday.Courts[2]
	if len(changedDuration.Slots) != 2 || changedDuration.Slots[0].Status != "RESERVED" || changedDuration.Slots[1].Status != "RESERVED" || len(changedDuration.OccupiedIntervals) != 1 {
		t.Fatalf("90-minute grid exposed false availability: slots=%+v occupied=%+v", changedDuration.Slots, changedDuration.OccupiedIntervals)
	}

	// Simulate the court lock and uncommitted insert used by HU-06. The public
	// snapshot must not wait on the lock or expose the uncommitted reservation.
	raceTx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer raceTx.Rollback(ctx)
	if _, err := raceTx.Exec(ctx, `SELECT id FROM courts WHERE id=$1::uuid FOR UPDATE`, gridCourtID); err != nil {
		t.Fatal(err)
	}
	if _, err := raceTx.Exec(ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,registered_by,starts_at,ends_at,status,companions,contact_name,contact_phone)
		VALUES($1::uuid,$2::uuid,$3::uuid,$3::uuid,'2026-10-30 20:00:00-03','2026-10-30 21:00:00-03','reserved',3,'PRIVATE CONTACT','555-PRIVATE')`, complexID, gridCourtID, registered.User.ID); err != nil {
		t.Fatal(err)
	}
	type concurrentHTTPResult struct {
		code int
		body []byte
		err  error
	}
	completed := make(chan concurrentHTTPResult, 1)
	go func() {
		requestContext, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		req, err := http.NewRequestWithContext(requestContext, http.MethodGet,
			fmt.Sprintf("%s/api/v1/complexes/%s/slots?date=2026-10-30", server.URL, complexID), nil)
		if err != nil {
			completed <- concurrentHTTPResult{err: err}
			return
		}
		resp, err := client.Do(req)
		if err != nil {
			completed <- concurrentHTTPResult{err: err}
			return
		}
		body, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		completed <- concurrentHTTPResult{code: resp.StatusCode, body: body, err: readErr}
	}()
	var duringReservation concurrentHTTPResult
	select {
	case duringReservation = <-completed:
	case <-time.After(4 * time.Second):
		t.Fatal("public availability blocked behind the HU-06-style court lock")
	}
	if duringReservation.err != nil || duringReservation.code != http.StatusOK {
		t.Fatalf("GET during uncommitted reservation status=%d err=%v body=%s", duringReservation.code, duringReservation.err, duringReservation.body)
	}
	var duringSnapshot slots.Response
	if err := json.Unmarshal(duringReservation.body, &duringSnapshot); err != nil {
		t.Fatal(err)
	}
	if got := duringSnapshot.Courts[0].Slots[2].Status; got != "AVAILABLE" {
		t.Fatalf("uncommitted reservation leaked into snapshot: slot status=%q", got)
	}
	if err := raceTx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	afterCommit, _ := request("2026-10-30")
	var committedSnapshot slots.Response
	if err := json.Unmarshal(afterCommit, &committedSnapshot); err != nil {
		t.Fatal(err)
	}
	if got := committedSnapshot.Courts[0].Slots[2].Status; got != "RESERVED" {
		t.Fatalf("committed reservation did not change subsequent availability: slot status=%q", got)
	}
	fridayOvernight := friday.Courts[1]
	if len(fridayOvernight.Slots) != 0 || len(fridayOvernight.OccupiedIntervals) != 1 {
		t.Fatalf("overnight projection on 30th=%+v", fridayOvernight)
	}
	if got := fridayOvernight.OccupiedIntervals[0]; got.VisibleStartsAt != "2026-10-30T23:30:00-03:00" || got.VisibleEndsAt != "2026-10-31T00:00:00-03:00" || got.OriginalEndsAt != "2026-10-31T01:00:00-03:00" {
		t.Fatalf("30th midnight fragment=%+v", got)
	}

	data, _ = request("2026-10-31")
	var saturday slots.Response
	if err := json.Unmarshal(data, &saturday); err != nil {
		t.Fatal(err)
	}
	if len(saturday.Courts) != 3 || len(saturday.Courts[1].Slots) != 0 || len(saturday.Courts[1].OccupiedIntervals) != 1 {
		t.Fatalf("overnight projection on 31st=%+v", saturday.Courts)
	}
	if got := saturday.Courts[1].OccupiedIntervals[0]; got.OriginalStartsAt != "2026-10-30T23:30:00-03:00" || got.OriginalEndsAt != "2026-10-31T01:00:00-03:00" || got.VisibleStartsAt != "2026-10-31T00:00:00-03:00" || got.VisibleEndsAt != "2026-10-31T01:00:00-03:00" {
		t.Fatalf("31st midnight fragment=%+v", got)
	}
	if len(saturday.Courts[0].Slots) != 3 || saturday.Courts[0].Slots[0].Status != "RESERVED" || saturday.Courts[0].Slots[1].Status != "RESERVED" || saturday.Courts[0].Slots[2].Status != "BLOCKED" || len(saturday.Courts[0].OccupiedIntervals) != 1 {
		t.Fatalf("disabled day/cancelled reservation handling=%+v", saturday.Courts[0])
	}

	var persistedStart, persistedEnd time.Time
	if err := db.QueryRow(ctx, `SELECT starts_at,ends_at FROM reservations WHERE court_id=$1::uuid`, overnightCourtID).Scan(&persistedStart, &persistedEnd); err != nil {
		t.Fatal(err)
	}
	if persistedStart.In(time.FixedZone("-03", -3*60*60)).Format(time.RFC3339) != "2026-10-30T23:30:00-03:00" || persistedEnd.In(time.FixedZone("-03", -3*60*60)).Format(time.RFC3339) != "2026-10-31T01:00:00-03:00" {
		t.Fatalf("database reservation changed: %s .. %s", persistedStart, persistedEnd)
	}

	var invalidCourtID, invalidDayID string
	if err := db.QueryRow(ctx, `INSERT INTO courts(complex_id,name,covered) VALUES($1::uuid,'Cancha inválida',false) RETURNING id::text`, complexID).Scan(&invalidCourtID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO court_schedule_days(court_id,weekday,enabled,duration_minutes) VALUES($1::uuid,5,true,60) RETURNING id::text`, invalidCourtID).Scan(&invalidDayID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO court_schedule_intervals(schedule_day_id,opens_at,closes_at) VALUES($1::uuid,'16:00','19:00'),($1::uuid,'17:00','20:00')`, invalidDayID); err != nil {
		t.Fatal(err)
	}
	var beforeIntervals, beforeReservations int
	if err := db.QueryRow(ctx, `SELECT (SELECT count(*) FROM court_schedule_intervals WHERE schedule_day_id=$1::uuid),(SELECT count(*) FROM reservations WHERE court_id=$2::uuid)`, invalidDayID, invalidCourtID).Scan(&beforeIntervals, &beforeReservations); err != nil {
		t.Fatal(err)
	}
	response, err := client.Get(fmt.Sprintf("%s/api/v1/complexes/%s/slots?date=2026-10-30", server.URL, complexID))
	if err != nil {
		t.Fatal(err)
	}
	responseBody, err := io.ReadAll(response.Body)
	response.Body.Close()
	if err != nil || response.StatusCode != http.StatusInternalServerError {
		t.Fatalf("inconsistent schedule status=%d err=%v body=%s", response.StatusCode, err, responseBody)
	}
	var afterIntervals, afterReservations int
	if err := db.QueryRow(ctx, `SELECT (SELECT count(*) FROM court_schedule_intervals WHERE schedule_day_id=$1::uuid),(SELECT count(*) FROM reservations WHERE court_id=$2::uuid)`, invalidDayID, invalidCourtID).Scan(&afterIntervals, &afterReservations); err != nil {
		t.Fatal(err)
	}
	if beforeIntervals != afterIntervals || beforeReservations != afterReservations {
		t.Fatalf("read-only inconsistency validation changed PostgreSQL: intervals %d -> %d, reservations %d -> %d", beforeIntervals, afterIntervals, beforeReservations, afterReservations)
	}

	var inactiveComplexID, emptyComplexID string
	if err := db.QueryRow(ctx, `INSERT INTO complexes(name,address,zone,phone,deleted_at) VALUES('Inactive','Calle 2','Gonnet','555',now()) RETURNING id::text`).Scan(&inactiveComplexID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO complexes(name,address,zone,phone) VALUES('No courts','Calle 3','Gonnet','555') RETURNING id::text`).Scan(&emptyComplexID); err != nil {
		t.Fatal(err)
	}
	statusRequest("/api/v1/complexes/"+inactiveComplexID+"/slots?date=2026-10-30", http.StatusNotFound)
	emptyData, _ := requestForComplex(t, client, server.URL, emptyComplexID, "2026-10-30")
	var empty slots.Response
	if err := json.Unmarshal(emptyData, &empty); err != nil || len(empty.Courts) != 0 || empty.Courts == nil {
		t.Fatalf("empty complex response=%s err=%v", emptyData, err)
	}
}

func requestForComplex(t *testing.T, client *http.Client, baseURL, complexID, date string) ([]byte, http.Header) {
	t.Helper()
	response, err := client.Get(fmt.Sprintf("%s/api/v1/complexes/%s/slots?date=%s", baseURL, complexID, date))
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	data, err := io.ReadAll(response.Body)
	if err != nil || response.StatusCode != http.StatusOK {
		t.Fatalf("GET empty complex status=%d err=%v body=%s", response.StatusCode, err, data)
	}
	return data, response.Header
}
