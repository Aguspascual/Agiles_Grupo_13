package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/complexes"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/courts"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/database"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/schedules"
	"github.com/jackc/pgx/v5/pgxpool"
)

func httpTestPool(t *testing.T) (*pgxpool.Pool, context.Context) {
	t.Helper()
	if testing.Short() {
		t.Skip("real HTTP/PostgreSQL flow disabled with -short")
	}
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL is not configured")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	t.Cleanup(cancel)
	admin, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(admin.Close)
	var name, schema string
	if err := admin.QueryRow(ctx, "SELECT current_database()").Scan(&name); err != nil {
		t.Fatal(err)
	}
	if name != "padelmatch_test" {
		t.Fatalf("refusing non-disposable database %q", name)
	}
	if err := admin.QueryRow(ctx, "SELECT 'hu04_http_' || replace(gen_random_uuid()::text,'-','')").Scan(&schema); err != nil {
		t.Fatal(err)
	}
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanup, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		if _, err := admin.Exec(cleanup, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Errorf("cleanup=%v", err)
		}
	})
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	return db, ctx
}

func testComplexImageDataURL(t *testing.T) string {
	t.Helper()
	picture := image.NewRGBA(image.Rect(0, 0, 1, 1))
	picture.Set(0, 0, color.RGBA{R: 20, G: 120, B: 80, A: 255})
	var content bytes.Buffer
	if err := png.Encode(&content, picture); err != nil {
		t.Fatal(err)
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(content.Bytes())
}

// S6; HU01 -> HU02 -> HU03 -> TDD0001/0003/0004, using real TCP HTTP and PostgreSQL.
func TestHTTPPostgresHU04Flow(t *testing.T) {
	db, ctx := httpTestPool(t)
	secret := []byte("only-for-http-integration-tests-at-least-32-bytes")
	server := httptest.NewServer(newHandler(db, secret))
	defer server.Close()
	client := server.Client()
	client.Timeout = 10 * time.Second
	request := func(method, path, token, body, revision string, status int) ([]byte, http.Header) {
		t.Helper()
		req, err := http.NewRequest(method, server.URL+path, strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		if revision != "" {
			req.Header.Set("If-Match", revision)
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		data, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Fatal(err)
		}
		if resp.StatusCode != status {
			t.Fatalf("%s %s status=%d expected=%d body=%s", method, path, resp.StatusCode, status, data)
		}
		return data, resp.Header
	}
	request("GET", "/health", "", "", "", 204)
	type session struct {
		User  auth.User `json:"user"`
		Token string    `json:"token"`
	}
	register := func(email string) session {
		body := fmt.Sprintf(`{"name":"HTTP test","email":%q,"password":"TestPassword-123!","zone":"Gonnet","level":"7ma","fairPlay":true}`, email)
		data, _ := request("POST", "/api/v1/auth/register", "", body, "", 201)
		var out session
		if err := json.Unmarshal(data, &out); err != nil {
			t.Fatal(err)
		}
		return out
	}
	admin, manager, other := register("admin@example.com"), register("manager@example.com"), register("other@example.com")
	if _, err := db.Exec(ctx, "UPDATE users SET role='ADMIN' WHERE id=$1", admin.User.ID); err != nil {
		t.Fatal(err)
	}
	loginBody := `{"email":"manager@example.com","password":"TestPassword-123!"}`
	login, _ := request("POST", "/api/v1/auth/login", "", loginBody, "", 200)
	var logged session
	if err := json.Unmarshal(login, &logged); err != nil || logged.User.ID != manager.User.ID {
		t.Fatalf("login=%v", err)
	}
	request("GET", "/api/v1/auth/me", logged.Token, "", "", 200)
	request("POST", "/api/v1/auth/login", "", strings.Replace(loginBody, "TestPassword-123!", "wrong", 1), "", 401)
	clubImage := testComplexImageDataURL(t)
	data, _ := request("POST", "/api/v1/complexes", admin.Token, fmt.Sprintf(`{"name":"HTTP complex","address":"1","zone":"Gonnet","phone":"123","imageDataUrl":%q,"managerIds":[%q]}`, clubImage, manager.User.ID), "", 201)
	var complexResponse struct {
		Complex complexes.Complex `json:"complex"`
	}
	if err := json.Unmarshal(data, &complexResponse); err != nil || complexResponse.Complex.ID == "" || complexResponse.Complex.ImageDataURL == nil || *complexResponse.Complex.ImageDataURL != clubImage {
		t.Fatalf("complex=%s err=%v", data, err)
	}
	data, _ = request("GET", "/api/v1/complexes", admin.Token, "", "", 200)
	var listed struct {
		Complexes []complexes.Complex `json:"complexes"`
	}
	if err := json.Unmarshal(data, &listed); err != nil || len(listed.Complexes) != 1 || listed.Complexes[0].ImageDataURL == nil || *listed.Complexes[0].ImageDataURL != clubImage {
		t.Fatalf("listed complex image=%s err=%v", data, err)
	}
	courtsPath := "/api/v1/complexes/" + complexResponse.Complex.ID + "/courts"
	data, _ = request("POST", courtsPath, manager.Token, `{"name":"HTTP court","covered":true,"features":["lighting"]}`, "", 201)
	var courtResponse struct {
		Court courts.Court `json:"court"`
	}
	if err := json.Unmarshal(data, &courtResponse); err != nil || courtResponse.Court.ID == "" {
		t.Fatalf("court=%s err=%v", data, err)
	}
	request("GET", courtsPath, manager.Token, "", "", 200)
	request("GET", courtsPath, other.Token, "", "", 403)
	base := courtsPath + "/" + courtResponse.Court.ID + "/weekly-schedule/days"
	request("GET", base, "", "", "", 401)
	data, _ = request("GET", base, manager.Token, "", "", 200)
	if strings.TrimSpace(string(data)) != `{"days":[]}` {
		t.Fatalf("empty week=%s", data)
	}
	request("POST", base, other.Token, `{"weekday":1,"enabled":true,"durationMinutes":60,"intervals":[{"opensAt":"09:00","closesAt":"13:00"}]}`, "", 403)
	data, headers := request("POST", base, manager.Token, `{"weekday":1,"enabled":true,"durationMinutes":60,"intervals":[{"opensAt":"09:00","closesAt":"13:00"}]}`, "", 201)
	var created struct {
		Day schedules.Day `json:"day"`
	}
	if err := json.Unmarshal(data, &created); err != nil {
		t.Fatal(err)
	}
	if headers.Get("ETag") != `"`+created.Day.Revision+`"` || headers.Get("Location") != base+"/1" {
		t.Fatalf("headers=%v", headers)
	}
	oldRevision := headers.Get("ETag")
	data, _ = request("PUT", base+"/1", manager.Token, `{"enabled":false,"durationMinutes":90,"intervals":[{"opensAt":"09:00","closesAt":"13:00"}]}`, oldRevision, 200)
	var updated struct {
		Day schedules.Day `json:"day"`
	}
	if err := json.Unmarshal(data, &updated); err != nil {
		t.Fatal(err)
	}
	if updated.Day.Enabled || updated.Day.DurationMinutes != 90 || updated.Day.Revision == created.Day.Revision || !reflect.DeepEqual(updated.Day.Intervals, created.Day.Intervals) {
		t.Fatalf("updated=%+v", updated.Day)
	}
	revision := `"` + updated.Day.Revision + `"`
	request("PUT", base+"/1", manager.Token, `{"enabled":true,"durationMinutes":90,"intervals":[{"opensAt":"09:00","closesAt":"13:00"}]}`, oldRevision, 412)
	request("DELETE", base+"/1", manager.Token, "", oldRevision, 412)
	request("DELETE", base+"/1", other.Token, "", revision, 403)
	request("DELETE", courtsPath+"/"+courtResponse.Court.ID, other.Token, "", "", 403)
	_, otherHeaders := request("POST", base, manager.Token, `{"weekday":2,"enabled":true,"durationMinutes":60,"intervals":[{"opensAt":"09:00","closesAt":"13:00"}]}`, "", 201)
	_, otherHeaders = request("PUT", base+"/2", manager.Token, `{"enabled":true,"durationMinutes":60,"intervals":[{"opensAt":"10:00","closesAt":"13:00"}]}`, otherHeaders.Get("ETag"), 200)
	request("DELETE", base+"/2", manager.Token, "", otherHeaders.Get("ETag"), 204)
	emptyCourt, _ := request("POST", courtsPath, manager.Token, `{"name":"Empty court","covered":true,"features":[]}`, "", 201)
	var emptyCourtResponse struct {
		Court courts.Court `json:"court"`
	}
	if err := json.Unmarshal(emptyCourt, &emptyCourtResponse); err != nil {
		t.Fatal(err)
	}
	request("DELETE", courtsPath+"/"+emptyCourtResponse.Court.ID, manager.Token, "", "", 204)
	_, err := db.Exec(ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,registered_by,starts_at,ends_at,status,companions,contact_name,contact_phone)
		SELECT $1,$2,$3,$3, start_at, start_at + interval '1 hour','reserved',3,'Test','123'
		FROM (SELECT (date_trunc('week', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') + interval '7 days 10 hours') AT TIME ZONE 'America/Argentina/Buenos_Aires' AS start_at) s`, complexResponse.Complex.ID, courtResponse.Court.ID, manager.User.ID)
	if err != nil {
		t.Fatal(err)
	}
	request("PUT", base+"/1", manager.Token, `{"enabled":false,"durationMinutes":90,"intervals":[{"opensAt":"11:00","closesAt":"13:00"}]}`, revision, 409)
	request("DELETE", base+"/1", manager.Token, "", revision, 409)
	request("DELETE", courtsPath+"/"+courtResponse.Court.ID, admin.Token, "", "", 409)
	// Restart the HTTP application, keeping only PostgreSQL as shared state.
	server.Close()
	server = httptest.NewServer(newHandler(db, secret))
	defer server.Close()
	data, _ = request("GET", base+"/1", admin.Token, "", "", 200)
	var persisted struct {
		Day schedules.Day `json:"day"`
	}
	if err := json.Unmarshal(data, &persisted); err != nil || !reflect.DeepEqual(persisted, updated) {
		t.Fatalf("persisted=%s err=%v", data, err)
	}
}

// TDD-0005 CA-01..CA-04; verifies HU-08 profile edits and persistence over real HTTP/PostgreSQL.
func TestHTTPPostgresHU08OwnProfileUpdate(t *testing.T) {
	db, _ := httpTestPool(t)
	secret := []byte("only-for-http-integration-tests-at-least-32-bytes")
	server := httptest.NewServer(newHandler(db, secret))
	defer server.Close()
	client := server.Client()
	request := func(method, path, token, body string, status int) []byte {
		t.Helper()
		req, err := http.NewRequest(method, server.URL+path, strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		data, err := io.ReadAll(resp.Body)
		if err != nil {
			t.Fatal(err)
		}
		if resp.StatusCode != status {
			t.Fatalf("%s %s status=%d expected=%d body=%s", method, path, resp.StatusCode, status, data)
		}
		return data
	}
	type session struct {
		User  auth.User `json:"user"`
		Token string    `json:"token"`
	}
	register := func(email string) session {
		body := fmt.Sprintf(`{"name":"Initial","email":%q,"password":"TestPassword-123!","zone":"Gonnet","level":"7ma","position":"Drive","hand":"Diestro","fairPlay":true}`, email)
		data := request("POST", "/api/v1/auth/register", "", body, http.StatusCreated)
		var out session
		if err := json.Unmarshal(data, &out); err != nil {
			t.Fatal(err)
		}
		return out
	}
	first, second := register("hu08-first@example.com"), register("hu08-second@example.com")
	// Existing login path still issues the same JWT used by both session endpoints.
	loginData := request("POST", "/api/v1/auth/login", "", `{"email":"hu08-first@example.com","password":"TestPassword-123!"}`, http.StatusOK)
	var logged session
	if err := json.Unmarshal(loginData, &logged); err != nil || logged.Token == "" {
		t.Fatalf("login=%v", err)
	}
	var originalEmail, originalPasswordHash, originalRole, originalFairPlay string
	if err := db.QueryRow(context.Background(), `SELECT u.email,u.password_hash,u.role,p.fair_play_accepted_at::text FROM users u JOIN player_profiles p ON p.user_id=u.id WHERE u.id=$1::uuid`, first.User.ID).Scan(&originalEmail, &originalPasswordHash, &originalRole, &originalFairPlay); err != nil {
		t.Fatal(err)
	}
	const path = "/api/v1/auth/me"
	request("PUT", path, "", `{"name":"Ana","zone":"Gonnet","level":"6ta","position":"Drive","hand":"Diestro"}`, http.StatusUnauthorized)
	request("PUT", path, "invalid", `{"name":"Ana","zone":"Gonnet","level":"6ta","position":"Drive","hand":"Diestro"}`, http.StatusUnauthorized)
	valid := `{"name":"  Ana Pérez  ","zone":"City Bell","level":"6ta","position":"Revés","hand":"Zurdo"}`
	updatedData := request("PUT", path, logged.Token, valid, http.StatusOK)
	var updated struct {
		User auth.User `json:"user"`
	}
	if err := json.Unmarshal(updatedData, &updated); err != nil {
		t.Fatal(err)
	}
	if updated.User.ID != first.User.ID || updated.User.Name != "Ana Pérez" || updated.User.Zone != "City Bell" || updated.User.Level != "6ta" || updated.User.Position != "Revés" || updated.User.Hand != "Zurdo" || strings.Contains(string(updatedData), `"token"`) {
		t.Fatalf("updated response=%s", updatedData)
	}
	readData := request("GET", path, logged.Token, "", http.StatusOK)
	if !strings.Contains(string(readData), `"name":"Ana Pérez"`) || !strings.Contains(string(readData), `"zone":"City Bell"`) {
		t.Fatalf("GET did not reflect update: %s", readData)
	}
	for _, body := range []string{
		`{"name":"Ana","zone":"Gonnet","level":"6ta","position":"Drive","hand":"Diestro","email":"x@y.z"}`,
		`{"name":"Ana","zone":"Gonnet","level":"6ta","position":"Drive","hand":"Diestro","id":"` + second.User.ID + `"}`,
		`{"name":"Ana","zone":"Gonnet","level":"6ta","position":"Drive"}`,
		`{"name":"Ana","zone":"Gonnet","level":"6ta","position":null,"hand":"Diestro"}`,
		`{"name":"Ana","zone":"Gonnet","level":"6ta","position":"Drive","hand":"Diestro","role":"ADMIN"}`,
		`{"name":"Ana","zone":"Gonnet","level":"Pro","position":"Drive","hand":"Diestro"}`,
		`{`,
		`{"name":"Ana","zone":"Gonnet","level":"6ta","position":"Drive","hand":"Diestro"} {}`,
	} {
		request("PUT", path, logged.Token, body, http.StatusBadRequest)
	}
	// Rejected requests leave the persisted profile unchanged.
	afterInvalid := request("GET", path, logged.Token, "", http.StatusOK)
	if !strings.Contains(string(afterInvalid), `"name":"Ana Pérez"`) {
		t.Fatalf("invalid update changed profile: %s", afterInvalid)
	}
	// Optional profile fields can be cleared with empty strings.
	request("PUT", path, logged.Token, `{"name":"Ana Pérez","zone":"City Bell","level":"6ta","position":"","hand":""}`, http.StatusOK)
	cleared := request("GET", path, logged.Token, "", http.StatusOK)
	if strings.Contains(string(cleared), `"position"`) || strings.Contains(string(cleared), `"hand"`) {
		t.Fatalf("optional values not cleared: %s", cleared)
	}
	other := request("GET", path, second.Token, "", http.StatusOK)
	if !strings.Contains(string(other), `"name":"Initial"`) || !strings.Contains(string(other), `"zone":"Gonnet"`) {
		t.Fatalf("another user profile changed: %s", other)
	}
	// Check protected columns were preserved in PostgreSQL itself.
	var email, passwordHash, role, fairPlay string
	if err := db.QueryRow(context.Background(), `SELECT u.email,u.password_hash,u.role,p.fair_play_accepted_at::text FROM users u JOIN player_profiles p ON p.user_id=u.id WHERE u.id=$1::uuid`, first.User.ID).Scan(&email, &passwordHash, &role, &fairPlay); err != nil {
		t.Fatal(err)
	}
	if email != originalEmail || passwordHash != originalPasswordHash || role != originalRole || fairPlay != originalFairPlay {
		t.Fatalf("protected data changed email=%s role=%s fairplay=%s", email, role, fairPlay)
	}
}
