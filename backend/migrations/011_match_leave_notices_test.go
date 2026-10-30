package migrations_test

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestMigration011PreservesNoticesAndAllowsRepeatKinds(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL no está configurado")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	admin, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close()
	var databaseName, schema string
	if err := admin.QueryRow(ctx, `SELECT current_database(), 'hu13_migration_' || replace(gen_random_uuid()::text,'-','')`).Scan(&databaseName, &schema); err != nil {
		t.Fatal(err)
	}
	if databaseName != "padelmatch_test" {
		t.Fatalf("refusing non-disposable database %q", databaseName)
	}
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanup, done := context.WithTimeout(context.Background(), 10*time.Second)
		defer done()
		_, _ = admin.Exec(cleanup, "DROP SCHEMA "+schema+" CASCADE")
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
	defer db.Close()
	if _, err := db.Exec(ctx, `CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		t.Fatal(err)
	}
	for _, version := range []string{"001_auth.sql", "002_complexes.sql", "003_courts.sql", "004_weekly_schedules.sql", "005_reservations.sql", "006_reservation_cancellation_notice.sql", "007_manual_reservations.sql", "008_pending_matches.sql", "009_full_match_invitations.sql", "010_invitee_directory_search.sql"} {
		if _, err := db.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES($1)`, version); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(ctx, `CREATE TABLE pending_match_notices (
		id UUID PRIMARY KEY, match_id UUID NOT NULL, user_id UUID NOT NULL,
		kind TEXT NOT NULL CONSTRAINT pending_match_notices_kind_check CHECK(kind='match_completed'),
		created_at TIMESTAMPTZ NOT NULL DEFAULT now(), read_at TIMESTAMPTZ,
		CONSTRAINT pending_match_notices_match_id_user_id_kind_key UNIQUE(match_id,user_id,kind))`); err != nil {
		t.Fatal(err)
	}
	const matchID = "00000000-0000-4000-8000-000000000013"
	const userID = "00000000-0000-4000-8000-000000000014"
	if _, err := db.Exec(ctx, `INSERT INTO pending_match_notices(id,match_id,user_id,kind) VALUES($1,$2,$3,'match_completed')`,
		"00000000-0000-4000-8000-000000000015", matchID, userID); err != nil {
		t.Fatal(err)
	}
	if err := database.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	var preserved int
	if err := db.QueryRow(ctx, `SELECT count(*) FROM pending_match_notices WHERE match_id=$1 AND user_id=$2 AND kind='match_completed'`, matchID, userID).Scan(&preserved); err != nil || preserved != 1 {
		t.Fatalf("preserved notices=%d err=%v", preserved, err)
	}
	for _, id := range []string{"00000000-0000-4000-8000-000000000016", "00000000-0000-4000-8000-000000000017"} {
		kind := "match_completed"
		if id == "00000000-0000-4000-8000-000000000017" {
			kind = "player_left"
		}
		if _, err := db.Exec(ctx, `INSERT INTO pending_match_notices(id,match_id,user_id,kind) VALUES($1,$2,$3,$4)`, id, matchID, userID, kind); err != nil {
			t.Fatalf("insert %s notice: %v", kind, err)
		}
	}
}
