package main

import (
	"context"
	"encoding/json"
	"fmt"
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
	data, _ := request("POST", "/api/v1/complexes", admin.Token, fmt.Sprintf(`{"name":"HTTP complex","address":"1","zone":"Gonnet","phone":"123","managerIds":[%q]}`, manager.User.ID), "", 201)
	var complexResponse struct {
		Complex complexes.Complex `json:"complex"`
	}
	if err := json.Unmarshal(data, &complexResponse); err != nil || complexResponse.Complex.ID == "" {
		t.Fatalf("complex=%s err=%v", data, err)
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
	request("PUT", base+"/1", manager.Token, `{"enabled":false,"durationMinutes":90,"intervals":[{"opensAt":"10:00","closesAt":"13:00"}]}`, revision, 503)
	request("DELETE", base+"/1", manager.Token, "", revision, 503)
	request("DELETE", courtsPath+"/"+courtResponse.Court.ID, admin.Token, "", "", 503)
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
