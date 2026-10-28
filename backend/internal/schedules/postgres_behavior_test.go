package schedules

import (
	"context"
	"errors"
	"reflect"
	"sync"
	"testing"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/complexes"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

const otherActor = "55555555-5555-4555-8555-555555555555"
const otherComplex = "66666666-6666-4666-8666-666666666666"

func TestSharedComplexAuthorization(t *testing.T) {
	db, ctx := newScheduleTestDB(t)
	seedScheduleCourt(t, db, ctx)
	for _, tt := range []struct {
		name, complex, actor string
		admin                bool
		want                 error
	}{
		{"assigned", testComplex, testActor, false, nil},
		{"unassigned", testComplex, otherActor, false, complexes.ErrForbidden},
		{"admin without assignment", testComplex, otherActor, true, nil},
		{"missing", testCourt, testActor, true, complexes.ErrNotFound},
	} {
		t.Run(tt.name, func(t *testing.T) {
			tx, err := db.Begin(ctx)
			if err != nil {
				t.Fatal(err)
			}
			defer tx.Rollback(ctx)
			err = complexes.AuthorizeInTransaction(ctx, tx, tt.complex, tt.actor, tt.admin)
			if !errors.Is(err, tt.want) {
				t.Fatalf("authorize=%v expected=%v", err, tt.want)
			}
		})
	}
	if _, err := db.Exec(ctx, "UPDATE complexes SET deleted_at=now() WHERE id=$1", testComplex); err != nil {
		t.Fatal(err)
	}
	tx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	if err := complexes.AuthorizeInTransaction(ctx, tx, testComplex, testActor, true); !errors.Is(err, complexes.ErrNotFound) {
		t.Fatalf("inactive=%v", err)
	}
}

func seedScheduleCourt(t *testing.T, db *pgxpool.Pool, ctx context.Context) {
	t.Helper()
	_, err := db.Exec(ctx, `INSERT INTO users(id,email,password_hash) VALUES($1,'hu04-manager@example.com','fixture'),($2,'hu04-other@example.com','fixture')`, testActor, otherActor)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(ctx, `INSERT INTO complexes(id,name,address,zone,phone) VALUES($1,'HU04 court owner','1','Gonnet','1'),($2,'HU04 other','2','Gonnet','2')`, testComplex, otherComplex)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(ctx, `INSERT INTO courts(id,complex_id,name,covered) VALUES($1,$2,'HU04 court',true)`, testCourt, testComplex)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec(ctx, "INSERT INTO complex_managers(complex_id,user_id) VALUES($1,$2)", testComplex, testActor); err != nil {
		t.Fatal(err)
	}
}

func scheduleDraft(weekday int) Draft {
	return Draft{Weekday: weekday, Enabled: true, DurationMinutes: 60, Intervals: []Interval{{OpensAt: "09:00", ClosesAt: "13:00"}, {OpensAt: "17:00", ClosesAt: "20:00"}}}
}

// TDD-0001 CA-01/02/05 and TDD-0004 CA-01..04.
// No fake reservation implementation is used in these real PostgreSQL checks.
func TestPostgresSchedulePersistenceAndPermissions(t *testing.T) {
	db, ctx := newScheduleTestDB(t)
	seedScheduleCourt(t, db, ctx)
	repo := NewPostgresRepository(db)
	days, err := repo.List(ctx, testComplex, testCourt, testActor, false)
	if err != nil || len(days) != 0 {
		t.Fatalf("empty week=%+v err=%v", days, err)
	}
	created, err := repo.Create(ctx, testComplex, testCourt, testActor, false, scheduleDraft(1))
	if err != nil {
		t.Fatalf("create schedule: %v", err)
	}
	if created.Revision == "" || len(created.Intervals) != 2 || created.Intervals[0].ID == "" {
		t.Fatalf("created=%+v", created)
	}
	if _, err := repo.Create(ctx, testComplex, testCourt, testActor, false, scheduleDraft(1)); !errors.Is(err, ErrConflict) {
		t.Fatalf("duplicate=%v", err)
	}
	tuesday, err := repo.Create(ctx, testComplex, testCourt, otherActor, true, scheduleDraft(2))
	if err != nil {
		t.Fatalf("admin without assignment: %v", err)
	}
	// A second connection/repository must observe persisted rows, not memory.
	second, err := pgxpool.NewWithConfig(ctx, db.Config())
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close()
	read, err := NewPostgresRepository(second).Get(ctx, testComplex, testCourt, testActor, false, 1)
	if err != nil || !reflect.DeepEqual(read, created) {
		t.Fatalf("read=%+v created=%+v err=%v", read, created, err)
	}
	stillTuesday, err := repo.Get(ctx, testComplex, testCourt, testActor, false, 2)
	if err != nil || !reflect.DeepEqual(stillTuesday, tuesday) {
		t.Fatal("Creating Monday changed Tuesday")
	}
	if _, err := repo.Get(ctx, testComplex, testCourt, testActor, false, 7); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing day=%v", err)
	}
	for _, action := range []func() error{
		func() error { _, e := repo.List(ctx, testComplex, testCourt, otherActor, false); return e },
		func() error { _, e := repo.Get(ctx, testComplex, testCourt, otherActor, false, 1); return e },
		func() error {
			_, e := repo.Create(ctx, testComplex, testCourt, otherActor, false, scheduleDraft(3))
			return e
		},
	} {
		if err := action(); !errors.Is(err, ErrForbidden) {
			t.Fatalf("foreign actor=%v", err)
		}
	}
	if _, err := repo.List(ctx, otherComplex, testCourt, otherActor, true); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign complex/court=%v", err)
	}
	if _, err := db.Exec(ctx, "UPDATE courts SET deleted_at=now() WHERE id=$1", testCourt); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.Get(ctx, testComplex, testCourt, testActor, true, 1); !errors.Is(err, ErrNotFound) {
		t.Fatalf("inactive court=%v", err)
	}
}

// TDD-0001 CA-05: only one concurrent creation wins.
func TestPostgresScheduleConcurrentCreate(t *testing.T) {
	db, ctx := newScheduleTestDB(t)
	seedScheduleCourt(t, db, ctx)
	repo := NewPostgresRepository(db)
	var wg sync.WaitGroup
	run := func(operation func() (Day, error)) ([]Day, []error) {
		start := make(chan struct{})
		results := make([]Day, 2)
		errs := make([]error, 2)
		for i := range results {
			wg.Add(1)
			go func(index int) { defer wg.Done(); <-start; results[index], errs[index] = operation() }(i)
		}
		close(start)
		wg.Wait()
		return results, errs
	}
	_, errs := run(func() (Day, error) {
		return repo.Create(ctx, testComplex, testCourt, testActor, false, scheduleDraft(1))
	})
	success, conflict := 0, 0
	for _, err := range errs {
		if err == nil {
			success++
		} else if errors.Is(err, ErrConflict) {
			conflict++
		} else {
			t.Fatal(err)
		}
	}
	if success != 1 || conflict != 1 {
		t.Fatalf("create errors=%v", errs)
	}
}

// TDD-0001 CA-05: a failure after inserting the header/first interval rolls back everything.
func TestPostgresScheduleRollback(t *testing.T) {
	db, ctx := newScheduleTestDB(t)
	seedScheduleCourt(t, db, ctx)
	_, err := db.Exec(ctx, `CREATE FUNCTION reject_second_interval() RETURNS trigger LANGUAGE plpgsql AS $$
	BEGIN IF NEW.opens_at = TIME '17:00' THEN RAISE EXCEPTION 'forced interval failure'; END IF; RETURN NEW; END $$;
	CREATE TRIGGER reject_second_interval BEFORE INSERT ON court_schedule_intervals FOR EACH ROW EXECUTE FUNCTION reject_second_interval()`)
	if err != nil {
		t.Fatal(err)
	}
	repo := NewPostgresRepository(db)
	_, err = repo.Create(ctx, testComplex, testCourt, testActor, false, scheduleDraft(1))
	var sqlErr *pgconn.PgError
	if !errors.As(err, &sqlErr) || sqlErr.Code != "P0001" {
		t.Fatalf("expected forced PostgreSQL exception, got %v", err)
	}
	for _, table := range []string{"court_schedule_days", "court_schedule_intervals"} {
		var count int
		if err := db.QueryRow(ctx, "SELECT count(*) FROM "+table).Scan(&count); err != nil || count != 0 {
			t.Fatalf("%s count=%d err=%v", table, count, err)
		}
	}
}
