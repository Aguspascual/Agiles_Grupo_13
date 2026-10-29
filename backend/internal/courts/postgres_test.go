package courts

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/complexes"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/database"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TestPostgresCourtsIntegration only runs against padelmatch_test and creates
// all test objects in a temporary schema which is dropped when the test ends.
func TestPostgresCourtsIntegration(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not configured")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	adminPool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer adminPool.Close()
	var databaseName string
	if err := adminPool.QueryRow(ctx, `SELECT current_database()`).Scan(&databaseName); err != nil {
		t.Fatal(err)
	}
	if databaseName != "padelmatch_test" {
		t.Fatalf("refusing integration test against database %q; expected padelmatch_test", databaseName)
	}
	var schema string
	if err := adminPool.QueryRow(ctx, `SELECT 'hu03_test_' || replace(gen_random_uuid()::text,'-','')`).Scan(&schema); err != nil {
		t.Fatal(err)
	}
	if _, err := adminPool.Exec(ctx, `CREATE SCHEMA `+schema); err != nil {
		t.Fatal(err)
	}
	defer func() { _, _ = adminPool.Exec(context.Background(), `DROP SCHEMA `+schema+` CASCADE`) }()
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err := database.Migrate(ctx, pool); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}
	if err := database.Migrate(ctx, pool); err != nil {
		t.Fatalf("repeat migrations: %v", err)
	}
	for _, migration := range []string{"001_auth.sql", "002_complexes.sql", "003_courts.sql"} {
		var migrationCount int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM schema_migrations WHERE version=$1`, migration).Scan(&migrationCount); err != nil || migrationCount != 1 {
			t.Fatalf("migration %s rows=%d err=%v", migration, migrationCount, err)
		}
	}

	var adminID, managerID, otherID, complexID, secondComplexID string
	for _, item := range []struct {
		email, role string
		target      *string
	}{
		{"hu03-admin@example.com", "ADMIN", &adminID}, {"hu03-manager@example.com", "USER", &managerID}, {"hu03-other@example.com", "USER", &otherID},
	} {
		if err := pool.QueryRow(ctx, `INSERT INTO users(email,password_hash,role) VALUES($1,'hash',$2) RETURNING id::text`, item.email, item.role).Scan(item.target); err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, `INSERT INTO player_profiles(user_id,name,zone,level,fair_play_accepted_at) VALUES($1::uuid,$2,'Gonnet','5ta',now())`, *item.target, item.email); err != nil {
			t.Fatal(err)
		}
	}
	if err := pool.QueryRow(ctx, `INSERT INTO complexes(name,address,zone,phone) VALUES('HU03 complejo','Calle 1','Gonnet','123') RETURNING id::text`).Scan(&complexID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO complexes(name,address,zone,phone) VALUES('HU03 otro','Calle 2','Gonnet','456') RETURNING id::text`).Scan(&secondComplexID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO complex_managers(complex_id,user_id) VALUES($1::uuid,$2::uuid)`, complexID, managerID); err != nil {
		t.Fatal(err)
	}
	// Exercise the explicit unavailable dependency separately from the real default.
	repo := NewPostgresRepositoryWithReservationChecker(pool, nil)
	png := tinyPNGDataURL()
	draft := Draft{Name: "Cancha persistida", Covered: true, Features: []string{"lighting", "wifi", "acrylicSurface"}, ImageDataURL: &png}
	created, err := repo.Create(ctx, complexID, adminID, true, draft)
	if err != nil {
		t.Fatalf("create court: %v", err)
	}
	if created.ID == "" || created.ComplexID != complexID || !created.Covered || len(created.Features) != 3 || created.ImageDataURL == nil {
		t.Fatalf("unexpected created court: %+v", created)
	}
	listed, err := repo.List(ctx, complexID, managerID, false)
	if err != nil || len(listed) != 1 || listed[0].ID != created.ID {
		t.Fatalf("manager list: %+v err=%v", listed, err)
	}
	if got, err := repo.List(ctx, secondComplexID, managerID, false); !errors.Is(err, ErrForbidden) || len(got) != 0 {
		t.Fatalf("foreign complex access: %+v err=%v", got, err)
	}
	draft.Name = "Cancha editada"
	draft.Covered = false
	draft.Features = []string{"electronicScoreboard"}
	draft.ImageDataURL = nil
	updated, err := repo.Update(ctx, complexID, created.ID, managerID, false, draft)
	if err != nil || updated.Name != "Cancha editada" || updated.Covered || len(updated.Features) != 1 || updated.Features[0] != "electronicScoreboard" || updated.ImageDataURL != nil {
		t.Fatalf("update court: %+v err=%v", updated, err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO courts(complex_id,name,covered) VALUES($1::uuid,'   ',true)`, complexID); !hasCourtPGError(err, "23514") {
		t.Fatalf("blank court name should violate CHECK, got %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO courts(complex_id,name,covered,image_data,image_mime_type) VALUES($1::uuid,'Bad image',true,decode('01','hex'),'image/gif')`, complexID); !hasCourtPGError(err, "23514") {
		t.Fatalf("unsupported image MIME should violate CHECK, got %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO courts(complex_id,name,covered) VALUES('00000000-0000-4000-8000-000000000099','Orphan',true)`); !hasCourtPGError(err, "23503") {
		t.Fatalf("unknown complex should violate court FK, got %v", err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM complexes WHERE id=$1::uuid`, complexID); !hasCourtPGError(err, "23503") {
		t.Fatalf("complex with courts should be protected by restrictive FK, got %v", err)
	}
	t.Run("reservation end boundary", func(t *testing.T) {
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		end := time.Date(2030, 5, 6, 11, 0, 0, 0, time.UTC)
		if _, err := tx.Exec(ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,starts_at,ends_at,status,companions,contact_name,contact_phone)
			VALUES($1,$2,$3,$4,$5,'reserved',3,'Test','123')`, complexID, created.ID, adminID, end.Add(-time.Hour), end); err != nil {
			t.Fatal(err)
		}
		checker := postgresReservationChecker{}
		clock := frozenCourtClockTx{Tx: tx}
		for _, tc := range []struct {
			name, extension string
			want            bool
		}{
			{"ends exactly at check", "0 microseconds", false},
			{"ends one microsecond later", "1 microsecond", true},
		} {
			t.Run(tc.name, func(t *testing.T) {
				if _, err := tx.Exec(ctx, `UPDATE reservations SET ends_at=$1::timestamptz + $2::interval WHERE court_id=$3`, end, tc.extension, created.ID); err != nil {
					t.Fatal(err)
				}
				got, err := checker.HasFutureReservations(ctx, clock, created.ID)
				if err != nil || got != tc.want {
					t.Fatalf("protected=%v err=%v", got, err)
				}
			})
		}
	})
	t.Run("real reservation protection", func(t *testing.T) {
		for _, tc := range []struct {
			name, status string
			start, end   time.Duration
			want         error
		}{
			{"future", "reserved", time.Hour, 2 * time.Hour, ErrFutureReservations},
			{"in progress", "reserved", -time.Hour, time.Hour, ErrFutureReservations},
			{"finished", "reserved", -2 * time.Hour, -time.Hour, nil},
			{"cancelled", "cancelled", time.Hour, 2 * time.Hour, nil},
		} {
			t.Run(tc.name, func(t *testing.T) {
				var courtID string
				if err := pool.QueryRow(ctx, `INSERT INTO courts(complex_id,name,covered) VALUES($1,$2,true) RETURNING id::text`, complexID, "Protection "+tc.name).Scan(&courtID); err != nil {
					t.Fatal(err)
				}
				t.Cleanup(func() {
					_, _ = pool.Exec(context.Background(), `DELETE FROM reservations WHERE court_id=$1`, courtID)
					_, _ = pool.Exec(context.Background(), `DELETE FROM courts WHERE id=$1`, courtID)
				})
				now := time.Now()
				if _, err := pool.Exec(ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,starts_at,ends_at,status,companions,contact_name,contact_phone)
					VALUES($1,$2,$3,$4,$5,$6,3,'Test','123')`, complexID, courtID, adminID, now.Add(tc.start), now.Add(tc.end), tc.status); err != nil {
					t.Fatal(err)
				}
				err := NewPostgresRepository(pool).Delete(ctx, complexID, courtID, adminID, true)
				if !errors.Is(err, tc.want) {
					t.Fatalf("delete=%v want=%v", err, tc.want)
				}
				var active bool
				var count int
				if err := pool.QueryRow(ctx, `SELECT deleted_at IS NULL FROM courts WHERE id=$1`, courtID).Scan(&active); err != nil {
					t.Fatal(err)
				}
				if err := pool.QueryRow(ctx, `SELECT count(*) FROM reservations WHERE court_id=$1`, courtID).Scan(&count); err != nil {
					t.Fatal(err)
				}
				if active != (tc.want != nil) || count != 1 {
					t.Fatalf("active=%v reservations=%d", active, count)
				}
			})
		}
	})
	if err := repo.Delete(ctx, complexID, created.ID, adminID, true); !errors.Is(err, ErrReservationSourceUnavailable) {
		t.Fatalf("delete without reservation source err=%v", err)
	}

	// Exercise the real HTTP handlers, auth lookup, role lookup, and PostgreSQL repository.
	secret := []byte(strings.Repeat("integration-secret-", 3))
	service := NewService(repo, complexes.NewPostgresRepository(pool))
	api := auth.RequireUser(secret, auth.NewPostgresRepository(pool), service.Handler())
	server := httptest.NewServer(api)
	defer server.Close()
	doHTTP := func(method, path, actor, body string) (*http.Response, []byte) {
		t.Helper()
		request, err := http.NewRequest(method, server.URL+path, strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		if actor != "" {
			request.Header.Set("Authorization", "Bearer "+signedTokenWithSecret(actor, secret))
		}
		if body != "" {
			request.Header.Set("Content-Type", "application/json")
		}
		response, err := http.DefaultClient.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		data, err := io.ReadAll(response.Body)
		_ = response.Body.Close()
		if err != nil {
			t.Fatal(err)
		}
		return response, data
	}
	base := "/api/v1/complexes/" + complexID + "/courts"
	image := tinyPNGDataURL()
	body := fmt.Sprintf(`{"name":"HTTP Cancha","covered":true,"features":["lighting","wifi","acrylicSurface"],"imageDataUrl":%q}`, image)
	createdHTTP, createdBody := doHTTP(http.MethodPost, base, adminID, body)
	if createdHTTP.StatusCode != http.StatusCreated {
		t.Fatalf("HTTP create status=%d body=%s", createdHTTP.StatusCode, createdBody)
	}
	var createdResponse struct {
		Court Court `json:"court"`
	}
	if err := json.Unmarshal(createdBody, &createdResponse); err != nil || createdResponse.Court.ID == "" || createdResponse.Court.ImageDataURL == nil {
		t.Fatalf("HTTP create response=%s err=%v", createdBody, err)
	}
	httpCourtID := createdResponse.Court.ID
	if got, _ := doHTTP(http.MethodGet, base, managerID, ""); got.StatusCode != http.StatusOK {
		t.Fatalf("authorized manager list status=%d", got.StatusCode)
	}
	if got, _ := doHTTP(http.MethodPost, "/api/v1/complexes/"+secondComplexID+"/courts", managerID, body); got.StatusCode != http.StatusForbidden {
		t.Fatalf("unassigned manager create status=%d", got.StatusCode)
	}
	if got, _ := doHTTP(http.MethodGet, "/api/v1/complexes/"+secondComplexID+"/courts", managerID, ""); got.StatusCode != http.StatusForbidden {
		t.Fatalf("unassigned manager list status=%d", got.StatusCode)
	}
	if got, _ := doHTTP(http.MethodPost, base, otherID, body); got.StatusCode != http.StatusForbidden {
		t.Fatalf("unassigned user create status=%d", got.StatusCode)
	}
	badImageBody := `{"name":"Bad image","covered":true,"features":[],"imageDataUrl":"data:image/png;base64,aGVsbG8="}`
	if got, _ := doHTTP(http.MethodPost, base, adminID, badImageBody); got.StatusCode != http.StatusBadRequest {
		t.Fatalf("invalid image status=%d", got.StatusCode)
	}
	badDraft := `{"name":" ","covered":true,"features":["unknown"]}`
	if got, _ := doHTTP(http.MethodPost, base, adminID, badDraft); got.StatusCode != http.StatusBadRequest {
		t.Fatalf("invalid draft status=%d", got.StatusCode)
	}
	updatedBody := fmt.Sprintf(`{"name":"HTTP Editada","covered":false,"features":["electronicScoreboard","wifi"],"imageDataUrl":%q}`, image)
	updatedHTTP, updatedJSON := doHTTP(http.MethodPut, base+"/"+httpCourtID, managerID, updatedBody)
	if updatedHTTP.StatusCode != http.StatusOK {
		t.Fatalf("HTTP update status=%d body=%s", updatedHTTP.StatusCode, updatedJSON)
	}
	var updatedResponse struct {
		Court Court `json:"court"`
	}
	if err := json.Unmarshal(updatedJSON, &updatedResponse); err != nil || updatedResponse.Court.Name != "HTTP Editada" || updatedResponse.Court.Covered || len(updatedResponse.Court.Features) != 2 || updatedResponse.Court.ImageDataURL == nil {
		t.Fatalf("HTTP update response=%s err=%v", updatedJSON, err)
	}
	var storedBytes int
	var storedLighting, storedScoreboard, storedWifi, storedAcrylic bool
	if err := pool.QueryRow(ctx, `SELECT octet_length(image_data),has_lighting,has_electronic_scoreboard,has_wifi,has_acrylic_surface FROM courts WHERE id=$1::uuid`, httpCourtID).Scan(&storedBytes, &storedLighting, &storedScoreboard, &storedWifi, &storedAcrylic); err != nil {
		t.Fatal(err)
	}
	if storedBytes == 0 || storedLighting || !storedScoreboard || !storedWifi || storedAcrylic {
		t.Fatalf("unexpected persisted image/features: bytes=%d features=%v", storedBytes, []bool{storedLighting, storedScoreboard, storedWifi, storedAcrylic})
	}
	listedHTTP, listedJSON := doHTTP(http.MethodGet, base, managerID, "")
	var listedResponse struct {
		Courts []Court `json:"courts"`
	}
	if listedHTTP.StatusCode != http.StatusOK || json.Unmarshal(listedJSON, &listedResponse) != nil {
		t.Fatalf("HTTP list status=%d body=%s", listedHTTP.StatusCode, listedJSON)
	}
	found := false
	for _, item := range listedResponse.Courts {
		if item.ID == httpCourtID && item.Name == "HTTP Editada" && item.ImageDataURL != nil && len(item.Features) == 2 {
			found = true
		}
	}
	if !found {
		t.Fatalf("updated court/features/image absent from HTTP list: %s", listedJSON)
	}
	deletedComplexID := ""
	if err := pool.QueryRow(ctx, `INSERT INTO complexes(name,address,zone,phone,deleted_at) VALUES('HU03 eliminado','Calle 3','Gonnet','789',now()) RETURNING id::text`).Scan(&deletedComplexID); err != nil {
		t.Fatal(err)
	}
	if got, _ := doHTTP(http.MethodPost, "/api/v1/complexes/"+deletedComplexID+"/courts", adminID, body); got.StatusCode != http.StatusNotFound {
		t.Fatalf("deleted complex create status=%d", got.StatusCode)
	}
	if got, _ := doHTTP(http.MethodDelete, base+"/"+httpCourtID, adminID, ""); got.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("delete without reservations source status=%d", got.StatusCode)
	}
	var activeAfterDelete int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM courts WHERE id=$1::uuid AND deleted_at IS NULL`, httpCourtID).Scan(&activeAfterDelete); err != nil || activeAfterDelete != 1 {
		t.Fatalf("court should remain active after rejected delete: count=%d err=%v", activeAfterDelete, err)
	}
	listed, err = repo.List(ctx, complexID, adminID, true)
	if err != nil || len(listed) != 2 {
		t.Fatalf("court should remain active after safe delete rejection: %+v err=%v", listed, err)
	}
	activeIDs := map[string]bool{}
	for _, item := range listed {
		activeIDs[item.ID] = true
	}
	if !activeIDs[created.ID] || !activeIDs[httpCourtID] {
		t.Fatalf("expected both non-deleted courts to remain active: %+v", listed)
	}
	if _, err := pool.Exec(ctx, `UPDATE complexes SET deleted_at=now() WHERE id=$1::uuid`, secondComplexID); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.List(ctx, secondComplexID, adminID, true); !errors.Is(err, ErrNotFound) {
		t.Fatalf("deleted complex should be inaccessible, err=%v", err)
	}
}

type frozenCourtClockTx struct{ pgx.Tx }

func (tx frozenCourtClockTx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return tx.Tx.QueryRow(ctx, strings.ReplaceAll(sql, "statement_timestamp()", "TIMESTAMPTZ '2030-05-06 11:00:00+00'"), args...)
}

func hasCourtPGError(err error, code string) bool {
	var pgErr *pgconn.PgError
	return err != nil && errors.As(err, &pgErr) && pgErr.Code == code
}
