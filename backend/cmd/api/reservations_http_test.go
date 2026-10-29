package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

// CA-01 through CA-05 require a disposable PostgreSQL database.
func TestHTTPPostgresReservationRace(t *testing.T) {
	db, ctx := httpTestPool(t)
	server := httptest.NewServer(newHandler(db, []byte("only-for-http-integration-tests-at-least-32-bytes")))
	defer server.Close()
	client := server.Client()
	client.Timeout = 10 * time.Second
	register := `{"name":"Jugador","email":"reservation@example.com","password":"TestPassword-123!","zone":"Gonnet","level":"7ma","fairPlay":true}`
	resp, err := client.Post(server.URL+"/api/v1/auth/register", "application/json", strings.NewReader(register))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("registration status = %d", resp.StatusCode)
	}
	var session struct {
		Token string `json:"token"`
		User  struct {
			ID string `json:"id"`
		} `json:"user"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
		t.Fatal(err)
	}
	var complexID, courtID, dayID string
	if err := db.QueryRow(ctx, `INSERT INTO complexes(name,address,zone,phone) VALUES('Complejo','Calle','Gonnet','123') RETURNING id::text`).Scan(&complexID); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `INSERT INTO courts(complex_id,name,covered) VALUES($1::uuid,'Cancha',false) RETURNING id::text`, complexID).Scan(&courtID); err != nil {
		t.Fatal(err)
	}
	loc, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	date := time.Now().In(loc).AddDate(0, 0, 2)
	weekday := int(date.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	if err := db.QueryRow(ctx, `INSERT INTO court_schedule_days(court_id,weekday,enabled,duration_minutes) VALUES($1::uuid,$2,true,90) RETURNING id::text`, courtID, weekday).Scan(&dayID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO court_schedule_intervals(schedule_day_id,opens_at,closes_at) VALUES($1::uuid,'17:00','21:30')`, dayID); err != nil {
		t.Fatal(err)
	}
	path := fmt.Sprintf("/api/v1/complexes/%s/courts/%s/reservations", complexID, courtID)
	body := fmt.Sprintf(`{"date":%q,"startsAt":"18:30","contact":{"name":"Ana","phone":"123"}}`, date.Format("2006-01-02"))
	request := func(token, content string) int {
		req, e := http.NewRequest("POST", server.URL+path, strings.NewReader(content))
		if e != nil {
			t.Error(e)
			return 0
		}
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		r, e := client.Do(req)
		if e != nil {
			t.Error(e)
			return 0
		}
		defer r.Body.Close()
		_, _ = io.Copy(io.Discard, r.Body)
		return r.StatusCode
	}
	if got := request("", body); got != http.StatusUnauthorized {
		t.Fatalf("unauthenticated = %d", got)
	}
	if got := request(session.Token, strings.Replace(body, `"phone":"123"`, `"phone":""`, 1)); got != http.StatusBadRequest {
		t.Fatalf("invalid = %d", got)
	}
	var wg sync.WaitGroup
	results := make(chan int, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); results <- request(session.Token, body) }()
	}
	wg.Wait()
	close(results)
	counts := map[int]int{}
	for status := range results {
		counts[status]++
	}
	if counts[http.StatusCreated] != 1 || counts[http.StatusConflict] != 1 {
		t.Fatalf("race results = %v", counts)
	}
	var reservations, notices int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM reservations WHERE court_id=$1::uuid AND organizer_id=$2::uuid AND contact_name='Ana' AND contact_phone='123'`, courtID, session.User.ID).Scan(&reservations); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM reservation_notices WHERE user_id=$1::uuid`, session.User.ID).Scan(&notices); err != nil {
		t.Fatal(err)
	}
	if reservations != 1 || notices != 1 {
		t.Fatalf("reservations=%d notices=%d", reservations, notices)
	}
	otherResp, err := client.Post(server.URL+"/api/v1/auth/register", "application/json", strings.NewReader(strings.Replace(register, "reservation@example.com", "other-reservation@example.com", 1)))
	if err != nil {
		t.Fatal(err)
	}
	defer otherResp.Body.Close()
	var other struct {
		Token string `json:"token"`
	}
	if otherResp.StatusCode != http.StatusCreated {
		t.Fatalf("other registration status = %d", otherResp.StatusCode)
	}
	if err := json.NewDecoder(otherResp.Body).Decode(&other); err != nil {
		t.Fatal(err)
	}
	noticesFor := func(token, suffix string) (int, []byte) {
		req, e := http.NewRequest(http.MethodGet, server.URL+"/api/v1/reservation-notices"+suffix, nil)
		if e != nil {
			t.Fatal(e)
		}
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		result, e := client.Do(req)
		if e != nil {
			t.Fatal(e)
		}
		defer result.Body.Close()
		if result.StatusCode == http.StatusOK && result.Header.Get("Cache-Control") != "no-store" {
			t.Errorf("notices cache control = %q", result.Header.Get("Cache-Control"))
		}
		data, e := io.ReadAll(result.Body)
		if e != nil {
			t.Fatal(e)
		}
		return result.StatusCode, data
	}
	if status, _ := noticesFor("", ""); status != http.StatusUnauthorized {
		t.Fatalf("notices unauthenticated = %d", status)
	}
	if status, _ := noticesFor("invalid-token", ""); status != http.StatusUnauthorized {
		t.Fatalf("notices invalid token = %d", status)
	}
	if status, _ := noticesFor(session.Token, "?userId=other"); status != http.StatusBadRequest {
		t.Fatalf("notices extra parameter = %d", status)
	}
	noticeStatus, noticeData := noticesFor(session.Token, "")
	var ownNotices struct {
		Notices []struct {
			ID          string    `json:"id"`
			Type        string    `json:"type"`
			CreatedAt   time.Time `json:"createdAt"`
			Reservation struct {
				ID       string `json:"id"`
				Date     string `json:"date"`
				StartsAt string `json:"startsAt"`
				EndsAt   string `json:"endsAt"`
				Complex  struct {
					Name string `json:"name"`
				} `json:"complex"`
				Court struct {
					Name string `json:"name"`
				} `json:"court"`
			} `json:"reservation"`
		} `json:"notices"`
	}
	if noticeStatus != http.StatusOK || json.Unmarshal(noticeData, &ownNotices) != nil || len(ownNotices.Notices) != 1 || ownNotices.Notices[0].ID == "" || ownNotices.Notices[0].Type != "reservation_confirmed" || ownNotices.Notices[0].Reservation.ID == "" || strings.Contains(string(noticeData), `"phone"`) {
		t.Fatalf("own notices status=%d body=%s", noticeStatus, noticeData)
	}
	confirmation := ownNotices.Notices[0]
	if confirmation.CreatedAt.IsZero() || confirmation.Reservation.Complex.Name != "Complejo" || confirmation.Reservation.Court.Name != "Cancha" || confirmation.Reservation.Date != date.Format("2006-01-02") || confirmation.Reservation.StartsAt != "18:30" || confirmation.Reservation.EndsAt != "20:00" {
		t.Fatalf("confirmation details = %+v", confirmation)
	}
	noticeStatus, noticeData = noticesFor(other.Token, "")
	var otherNotices struct {
		Notices []json.RawMessage `json:"notices"`
	}
	if noticeStatus != http.StatusOK || json.Unmarshal(noticeData, &otherNotices) != nil || len(otherNotices.Notices) != 0 {
		t.Fatalf("other notices status=%d body=%s", noticeStatus, noticeData)
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM reservation_notices WHERE user_id=$1::uuid`, session.User.ID).Scan(&notices); err != nil || notices != 1 {
		t.Fatalf("notice count after reads=%d error=%v", notices, err)
	}
	listOwn := func(token, query string) (int, []byte) {
		req, e := http.NewRequest(http.MethodGet, server.URL+"/api/v1/reservations"+query, nil)
		if e != nil {
			t.Fatal(e)
		}
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		result, e := client.Do(req)
		if e != nil {
			t.Fatal(e)
		}
		defer result.Body.Close()
		data, e := io.ReadAll(result.Body)
		if e != nil {
			t.Fatal(e)
		}
		return result.StatusCode, data
	}
	query := "?date=" + date.Format("2006-01-02")
	if status, _ := listOwn("", query); status != http.StatusUnauthorized {
		t.Fatalf("list unauthenticated = %d", status)
	}
	if status, _ := listOwn(session.Token, "?date=2026-02-30"); status != http.StatusBadRequest {
		t.Fatalf("list invalid date = %d", status)
	}
	status, data := listOwn(session.Token, query)
	var own struct {
		Reservations []struct {
			ID   string `json:"id"`
			Date string `json:"date"`
		} `json:"reservations"`
	}
	if status != http.StatusOK || json.Unmarshal(data, &own) != nil || len(own.Reservations) != 1 || own.Reservations[0].ID == "" || own.Reservations[0].Date != date.Format("2006-01-02") || strings.Contains(string(data), `"phone"`) || strings.Contains(string(data), `"contact"`) {
		t.Fatalf("own list status=%d body=%s", status, data)
	}
	status, data = listOwn(other.Token, query)
	var others struct {
		Reservations []json.RawMessage `json:"reservations"`
	}
	if status != http.StatusOK || json.Unmarshal(data, &others) != nil || len(others.Reservations) != 0 {
		t.Fatalf("other list status=%d body=%s", status, data)
	}
	status, data = listOwn(session.Token, "?date="+date.AddDate(0, 0, 1).Format("2006-01-02"))
	var anotherDay struct {
		Reservations []json.RawMessage `json:"reservations"`
	}
	if status != http.StatusOK || json.Unmarshal(data, &anotherDay) != nil || len(anotherDay.Reservations) != 0 {
		t.Fatalf("other date status=%d body=%s", status, data)
	}
	if got := request(session.Token, strings.Replace(body, `"startsAt":"18:30"`, `"startsAt":"17:00"`, 1)); got != http.StatusCreated {
		t.Fatalf("second reservation status = %d", got)
	}
	noticeStatus, noticeData = noticesFor(session.Token, "")
	var ordered struct {
		Notices []struct {
			ID        string    `json:"id"`
			CreatedAt time.Time `json:"createdAt"`
		} `json:"notices"`
	}
	if noticeStatus != http.StatusOK || json.Unmarshal(noticeData, &ordered) != nil || len(ordered.Notices) != 2 {
		t.Fatalf("ordered notices status=%d body=%s", noticeStatus, noticeData)
	}
	first, second := ordered.Notices[0], ordered.Notices[1]
	if first.CreatedAt.Before(second.CreatedAt) || (first.CreatedAt.Equal(second.CreatedAt) && first.ID < second.ID) {
		t.Fatalf("notice ordering = %+v", ordered.Notices)
	}
	// Force notice failure in the isolated test schema: the reservation must roll back.
	_, err = db.Exec(ctx, `CREATE FUNCTION fail_reservation_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test notice failure'; END $$`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(ctx, `CREATE TRIGGER fail_reservation_notice BEFORE INSERT ON reservation_notices FOR EACH ROW EXECUTE FUNCTION fail_reservation_notice()`)
	if err != nil {
		t.Fatal(err)
	}
	if got := request(session.Token, strings.Replace(body, `"startsAt":"18:30"`, `"startsAt":"20:00"`, 1)); got != http.StatusInternalServerError {
		t.Fatalf("notice failure status = %d", got)
	}
	if err := db.QueryRow(ctx, `SELECT count(*) FROM reservations WHERE court_id=$1::uuid`, courtID).Scan(&reservations); err != nil {
		t.Fatal(err)
	}
	if reservations != 2 {
		t.Fatalf("notice failure left %d reservations, want 2", reservations)
	}
	// The schema belongs only to this disposable test; rename simulates a read failure.
	if _, err := db.Exec(ctx, `ALTER TABLE reservation_notices RENAME TO reservation_notices_unavailable`); err != nil {
		t.Fatal(err)
	}
	if status, response := noticesFor(session.Token, ""); status != http.StatusInternalServerError || strings.TrimSpace(string(response)) != `{"error":"no se pudieron consultar los avisos"}` {
		t.Fatalf("notice read failure status=%d body=%s", status, response)
	}
}
