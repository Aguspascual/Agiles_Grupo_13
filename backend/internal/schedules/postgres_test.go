package schedules

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func newScheduleTestDB(t *testing.T) (*pgxpool.Pool, context.Context) {
	t.Helper()
	if testing.Short() {
		t.Skip("real PostgreSQL integration disabled with -short")
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
	if err := admin.QueryRow(ctx, "SELECT 'hu04_test_' || replace(gen_random_uuid()::text,'-','')").Scan(&schema); err != nil {
		t.Fatal(err)
	}
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanupCtx, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		if _, err := admin.Exec(cleanupCtx, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Errorf("clean schema: %v", err)
		}
	})
	config, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema
	config.ConnConfig.RuntimeParams["application_name"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := database.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	return pool, ctx
}

// TDD-0001 CA-02/05: the embedded numbered migration must create both tables once.
func TestPostgresScheduleMigration(t *testing.T) {
	db, ctx := newScheduleTestDB(t)
	for _, table := range []string{"court_schedule_days", "court_schedule_intervals"} {
		var exists bool
		if err := db.QueryRow(ctx, "SELECT to_regclass($1) IS NOT NULL", table).Scan(&exists); err != nil {
			t.Fatal(err)
		}
		if !exists {
			t.Fatalf("missing schedule table %s", table)
		}
	}
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := db.QueryRow(ctx, "SELECT count(*) FROM schema_migrations WHERE version='004_weekly_schedules.sql'").Scan(&count); err != nil || count != 1 {
		t.Fatalf("migration count=%d err=%v", count, err)
	}
}
