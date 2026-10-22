package database

import (
	"context"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/complexes"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Set TEST_DATABASE_URL to a disposable PostgreSQL database to exercise the real migration runner.
func TestMigrateAppliesHU02Schema(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not configured")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	adminPool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer adminPool.Close()
	var schema string
	err = adminPool.QueryRow(ctx, `SELECT 'hu02_test_' || replace(gen_random_uuid()::text,'-','')`).Scan(&schema)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = adminPool.Exec(ctx, `CREATE SCHEMA `+schema); err != nil {
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
	if err := Migrate(ctx, pool); err != nil {
		t.Fatalf("apply migrations: %v", err)
	}
	var roleDefault string
	if err := pool.QueryRow(ctx, `SELECT column_default FROM information_schema.columns WHERE table_schema=$1 AND table_name='users' AND column_name='role'`, schema).Scan(&roleDefault); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(roleDefault, "USER") {
		t.Fatalf("role default = %q", roleDefault)
	}
	var indexCount int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM pg_indexes WHERE schemaname=$1 AND indexname IN ('complexes_active_idx','complex_managers_pkey','complex_managers_user_id_idx')`, schema).Scan(&indexCount); err != nil || indexCount != 3 {
		t.Fatalf("expected three HU-02 indexes, got %d, err=%v", indexCount, err)
	}
	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM schema_migrations WHERE version='002_complexes.sql'`).Scan(&count); err != nil || count != 1 {
		t.Fatalf("migration history count=%d err=%v", count, err)
	}
	for _, table := range []string{"complexes", "complex_managers"} {
		var exists bool
		if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2)`, schema, table).Scan(&exists); err != nil || !exists {
			t.Fatalf("table %s exists=%v err=%v", table, exists, err)
		}
	}
	var role string
	if err := pool.QueryRow(ctx, `INSERT INTO users(email,password_hash) VALUES('test@example.com','hash') RETURNING role`).Scan(&role); err != nil || role != "USER" {
		t.Fatalf("new user role=%q err=%v", role, err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO users(email,password_hash,role) VALUES('invalid-role@example.com','hash','MANAGER')`); !hasPGErrorCode(err, "23514") {
		t.Fatalf("invalid role should violate CHECK constraint, got %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO complexes(name,address,zone,phone) VALUES('Invalid zone','Address','La Plata','123')`); !hasPGErrorCode(err, "23514") {
		t.Fatalf("invalid zone should violate CHECK constraint, got %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO complex_managers(complex_id,user_id) VALUES(gen_random_uuid(),gen_random_uuid())`); !hasPGErrorCode(err, "23503") {
		t.Fatalf("missing manager/complex should violate FK constraint, got %v", err)
	}
	if err := Migrate(ctx, pool); err != nil {
		t.Fatalf("second migrate: %v", err)
	}
	var adminID, firstManagerID, secondManagerID string
	if err := pool.QueryRow(ctx, `INSERT INTO users(email,password_hash,role) VALUES('admin@example.com','hash','ADMIN') RETURNING id::text`).Scan(&adminID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO users(email,password_hash) VALUES('manager1@example.com','hash') RETURNING id::text`).Scan(&firstManagerID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO users(email,password_hash) VALUES('manager2@example.com','hash') RETURNING id::text`).Scan(&secondManagerID); err != nil {
		t.Fatal(err)
	}
	for _, user := range []struct{ id, name string }{{adminID, "Admin"}, {firstManagerID, "Manager One"}, {secondManagerID, "Manager Two"}} {
		if _, err := pool.Exec(ctx, `INSERT INTO player_profiles(user_id,name,zone,level,fair_play_accepted_at) VALUES($1::uuid,$2,'Gonnet','7ma',now())`, user.id, user.name); err != nil {
			t.Fatal(err)
		}
	}
	repo := complexes.NewPostgresRepository(pool)
	draft := complexes.Draft{Name: "Club Prueba", Address: "Calle 1", Zone: "San Carlos", Phone: "221 555-0100", ManagerIDs: []string{firstManagerID, secondManagerID}}
	created, err := repo.Create(ctx, draft)
	if err != nil {
		t.Fatalf("create complex: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO complex_managers(complex_id,user_id) VALUES($1::uuid,$2::uuid)`, created.ID, firstManagerID); !hasPGErrorCode(err, "23505") {
		t.Fatalf("duplicate manager assignment should violate primary key, got %v", err)
	}
	listed, err := repo.List(ctx, adminID, true)
	if err != nil || len(listed) != 1 || len(listed[0].ManagerIDs) != 2 {
		t.Fatalf("list persisted managers: %+v err=%v", listed, err)
	}
	draft.Name = "Club Modificado"
	updated, err := repo.Update(ctx, created.ID, adminID, true, draft)
	if err != nil || updated.Name != "Club Modificado" {
		t.Fatalf("update complex: %+v err=%v", updated, err)
	}
	if err := repo.Delete(ctx, created.ID); err != nil {
		t.Fatalf("logical delete: %v", err)
	}
	listed, err = repo.List(ctx, adminID, true)
	if err != nil || len(listed) != 0 {
		t.Fatalf("deleted complex listed: %+v err=%v", listed, err)
	}
}

func hasPGErrorCode(err error, code string) bool {
	var pgErr *pgconn.PgError
	return err != nil && errors.As(err, &pgErr) && pgErr.Code == code
}
