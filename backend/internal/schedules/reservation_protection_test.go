package schedules

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/courts"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/reservations"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Replace only the clock expression, leaving the production SQL predicates intact.
type frozenStatementTx struct{ pgx.Tx }

func (tx frozenStatementTx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return tx.Tx.QueryRow(ctx, strings.ReplaceAll(sql, "statement_timestamp()", "TIMESTAMPTZ '2030-05-06 11:00:00+00'"), args...)
}

func (tx frozenStatementTx) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return tx.Tx.Query(ctx, strings.ReplaceAll(sql, "statement_timestamp()", "TIMESTAMPTZ '2030-05-06 11:00:00+00'"), args...)
}

func TestReservationEndAtExactCheckTime(t *testing.T) {
	db, ctx := newScheduleTestDB(t)
	seedScheduleCourt(t, db, ctx)
	end := time.Date(2030, 5, 6, 11, 0, 0, 0, time.UTC)
	start := end.Add(-time.Hour)
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	weekday := int(start.In(location).Weekday())
	if weekday == 0 {
		weekday = 7
	}
	insertProtectionReservation(t, ctx, db, testCourt, "reserved", start, end)
	tx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	clock := frozenStatementTx{Tx: tx}
	checker := postgresReservationChecker{}
	for _, tc := range []struct {
		name      string
		extension string
		want      bool
	}{
		{"ends exactly at check", "0 microseconds", false},
		{"ends one microsecond later", "1 microsecond", true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := tx.Exec(ctx, `UPDATE reservations SET ends_at=$1::timestamptz + $2::interval WHERE court_id=$3`, end, tc.extension, testCourt); err != nil {
				t.Fatal(err)
			}
			exists, err := checker.HasFutureReservations(ctx, clock, testCourt, weekday)
			if err != nil || exists != tc.want {
				t.Fatalf("exists=%v err=%v", exists, err)
			}
			outside, err := checker.HasReservationsOutside(ctx, clock, testCourt, weekday, []Interval{{OpensAt: "00:00", ClosesAt: "01:00"}})
			if err != nil || outside != tc.want {
				t.Fatalf("outside=%v err=%v", outside, err)
			}
		})
	}
}

func insertProtectionReservation(t *testing.T, ctx context.Context, db *pgxpool.Pool, court, status string, start, end time.Time) {
	t.Helper()
	_, err := db.Exec(ctx, `INSERT INTO reservations(complex_id,court_id,organizer_id,starts_at,ends_at,status,companions,contact_name,contact_phone)
		VALUES($1,$2,$3,$4,$5,$6,3,'Test','123')`, testComplex, court, testActor, start, end, status)
	if err != nil {
		t.Fatal(err)
	}
}

func TestReservationCreationRacesWithConfiguration(t *testing.T) {
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	for _, action := range []string{"court delete", "day delete", "interval update"} {
		t.Run(action, func(t *testing.T) {
			db, ctx := newScheduleTestDB(t)
			seedScheduleCourt(t, db, ctx)
			date := time.Now().In(location).AddDate(0, 0, 7)
			start := time.Date(date.Year(), date.Month(), date.Day(), 10, 0, 0, 0, location)
			weekday := int(start.Weekday())
			if weekday == 0 {
				weekday = 7
			}
			schedule := NewPostgresRepository(db)
			draft := scheduleDraft(weekday)
			day, err := schedule.Create(ctx, testComplex, testCourt, testActor, false, draft)
			if err != nil {
				t.Fatal(err)
			}
			gate := make(chan struct{})
			bookResult, changeResult := make(chan error, 1), make(chan error, 1)
			go func() {
				<-gate
				_, err := reservations.NewRepository(db).Create(ctx, testComplex, testCourt, testActor,
					reservations.Request{Date: start.Format("2006-01-02"), StartsAt: "10:00", Contact: reservations.Contact{Name: "Test", Phone: "123"}}, start)
				bookResult <- err
			}()
			go func() {
				<-gate
				var err error
				switch action {
				case "court delete":
					err = courts.NewPostgresRepository(db).Delete(ctx, testComplex, testCourt, testActor, false)
				case "day delete":
					err = schedule.Delete(ctx, testComplex, testCourt, testActor, false, weekday, day.Revision)
				case "interval update":
					draft.Intervals = []Interval{{OpensAt: "11:00", ClosesAt: "13:00"}}
					_, err = schedule.Update(ctx, testComplex, testCourt, testActor, false, day.Revision, draft)
				}
				changeResult <- err
			}()
			close(gate)
			bookErr, changeErr := <-bookResult, <-changeResult
			if bookErr == nil {
				if action == "court delete" && !errors.Is(changeErr, courts.ErrFutureReservations) {
					t.Fatalf("book succeeded; court change=%v", changeErr)
				}
				if action != "court delete" && !errors.Is(changeErr, ErrFutureReservations) {
					t.Fatalf("book succeeded; schedule change=%v", changeErr)
				}
			} else {
				if changeErr != nil || (!errors.Is(bookErr, reservations.ErrConflict) && !errors.Is(bookErr, reservations.ErrNotFound)) {
					t.Fatalf("book=%v change=%v", bookErr, changeErr)
				}
			}
			var count int
			if err := db.QueryRow(ctx, `SELECT count(*) FROM reservations WHERE court_id=$1 AND status='reserved'`, testCourt).Scan(&count); err != nil {
				t.Fatal(err)
			}
			if (bookErr == nil && count != 1) || (bookErr != nil && count != 0) {
				t.Fatalf("book=%v count=%d", bookErr, count)
			}
		})
	}
}

func TestReservationCoverageBoundaries(t *testing.T) {
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name                                string
		startHour, startMinute, startSecond int
		length                              time.Duration
		wantOutside                         bool
	}{
		{"exact endpoints", 10, 0, 0, time.Hour, false},
		{"before opening", 9, 59, 59, time.Hour, true},
		{"after closing", 10, 0, 0, time.Hour + time.Second, true},
		{"crosses midnight", 23, 30, 0, time.Hour, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db, ctx := newScheduleTestDB(t)
			seedScheduleCourt(t, db, ctx)
			date := time.Now().In(location).AddDate(0, 0, 7)
			start := time.Date(date.Year(), date.Month(), date.Day(), tc.startHour, tc.startMinute, tc.startSecond, 0, location)
			weekday := int(start.Weekday())
			if weekday == 0 {
				weekday = 7
			}
			insertProtectionReservation(t, ctx, db, testCourt, "reserved", start, start.Add(tc.length))
			tx, err := db.Begin(ctx)
			if err != nil {
				t.Fatal(err)
			}
			defer tx.Rollback(ctx)
			checker := postgresReservationChecker{}
			outside, err := checker.HasReservationsOutside(ctx, tx, testCourt, weekday, []Interval{{OpensAt: "10:00", ClosesAt: "11:00"}})
			if err != nil || outside != tc.wantOutside {
				t.Fatalf("outside=%v err=%v", outside, err)
			}
			exists, err := checker.HasFutureReservations(ctx, tx, testCourt, weekday%7+1)
			if err != nil || exists {
				t.Fatalf("other local day exists=%v err=%v", exists, err)
			}
		})
	}
}

func TestInProgressReservationPreservedOnDisableAndDurationChange(t *testing.T) {
	db, ctx := newScheduleTestDB(t)
	seedScheduleCourt(t, db, ctx)
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	start := time.Now().In(location).Add(-5 * time.Minute)
	end := start.Add(time.Hour)
	weekday := int(start.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	insertProtectionReservation(t, ctx, db, testCourt, "reserved", start, end)
	repo := NewPostgresRepository(db)
	draft := scheduleDraft(weekday)
	day, err := repo.Create(ctx, testComplex, testCourt, testActor, false, draft)
	if err != nil {
		t.Fatal(err)
	}
	affected := draft
	if start.Hour() < 12 {
		affected.Intervals = []Interval{{OpensAt: "17:00", ClosesAt: "20:00"}}
	} else {
		affected.Intervals = []Interval{{OpensAt: "00:00", ClosesAt: "03:00"}}
	}
	if _, err := repo.Update(ctx, testComplex, testCourt, testActor, false, day.Revision, affected); !errors.Is(err, ErrFutureReservations) {
		t.Fatalf("in-progress interval update=%v", err)
	}
	draft.Enabled, draft.DurationMinutes = false, 90
	updated, err := repo.Update(ctx, testComplex, testCourt, testActor, false, day.Revision, draft)
	if err != nil || updated.Enabled || updated.DurationMinutes != 90 {
		t.Fatalf("update=%+v err=%v", updated, err)
	}
	if err := repo.Delete(ctx, testComplex, testCourt, testActor, false, weekday, updated.Revision); !errors.Is(err, ErrFutureReservations) {
		t.Fatalf("delete=%v", err)
	}
	var gotStart, gotEnd time.Time
	var status string
	if err := db.QueryRow(ctx, `SELECT starts_at, ends_at, status FROM reservations WHERE court_id=$1`, testCourt).Scan(&gotStart, &gotEnd, &status); err != nil {
		t.Fatal(err)
	}
	if !gotStart.Equal(start.Truncate(time.Microsecond)) || !gotEnd.Equal(end.Truncate(time.Microsecond)) || status != "reserved" {
		t.Fatalf("reservation changed: %v %v %s", gotStart, gotEnd, status)
	}
}

func TestReservationCheckErrorsDoNotMutate(t *testing.T) {
	db, ctx := newScheduleTestDB(t)
	seedScheduleCourt(t, db, ctx)
	repo := NewPostgresRepository(db)
	draft := scheduleDraft(1)
	day, err := repo.Create(ctx, testComplex, testCourt, testActor, false, draft)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `DROP TABLE reservations CASCADE`); err != nil {
		t.Fatal(err)
	}
	changed := draft
	changed.Intervals = []Interval{{OpensAt: "10:00", ClosesAt: "13:00"}}
	if _, err := repo.Update(ctx, testComplex, testCourt, testActor, false, day.Revision, changed); err == nil {
		t.Fatal("update succeeded after query failure")
	}
	if err := repo.Delete(ctx, testComplex, testCourt, testActor, false, 1, day.Revision); err == nil {
		t.Fatal("day delete succeeded after query failure")
	}
	if err := courts.NewPostgresRepository(db).Delete(ctx, testComplex, testCourt, testActor, false); err == nil {
		t.Fatal("court delete succeeded after query failure")
	}
	got, err := repo.Get(ctx, testComplex, testCourt, testActor, false, 1)
	if err != nil || got.Revision != day.Revision {
		t.Fatalf("day changed: %+v err=%v", got, err)
	}
	var active bool
	if err := db.QueryRow(ctx, `SELECT deleted_at IS NULL FROM courts WHERE id=$1`, testCourt).Scan(&active); err != nil || !active {
		t.Fatalf("court active=%v err=%v", active, err)
	}
}

func TestReservationIsolationByCourtAndLocalWeekday(t *testing.T) {
	db, ctx := newScheduleTestDB(t)
	seedScheduleCourt(t, db, ctx)
	const otherCourt = "77777777-7777-4777-8777-777777777777"
	if _, err := db.Exec(ctx, `INSERT INTO courts(id,complex_id,name,covered) VALUES($1,$2,'Other',true)`, otherCourt, testComplex); err != nil {
		t.Fatal(err)
	}
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	date := time.Now().In(location).AddDate(0, 0, 7)
	start := time.Date(date.Year(), date.Month(), date.Day(), 23, 30, 0, 0, location)
	weekday := int(start.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	insertProtectionReservation(t, ctx, db, otherCourt, "reserved", start, start.Add(time.Hour))
	insertProtectionReservation(t, ctx, db, testCourt, "reserved", start.AddDate(0, 0, 1), start.AddDate(0, 0, 1).Add(time.Hour))
	tx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	checker := postgresReservationChecker{}
	got, err := checker.HasFutureReservations(ctx, tx, testCourt, weekday)
	if err != nil || got {
		t.Fatalf("other court/day affected target: got=%v err=%v", got, err)
	}
	got, err = checker.HasFutureReservations(ctx, tx, otherCourt, weekday)
	if err != nil || !got {
		t.Fatalf("local weekday not recognized: got=%v err=%v", got, err)
	}
}

func TestReservationProtectionCourt(t *testing.T) {
	for _, tc := range []struct {
		name, status string
		start, end   time.Duration
		want         error
	}{
		{"future reserved", "reserved", time.Hour, 2 * time.Hour, courts.ErrFutureReservations},
		{"in progress", "reserved", -time.Hour, time.Hour, courts.ErrFutureReservations},
		{"finished", "reserved", -2 * time.Hour, -time.Hour, nil},
		{"cancelled", "cancelled", time.Hour, 2 * time.Hour, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db, ctx := newScheduleTestDB(t)
			seedScheduleCourt(t, db, ctx)
			now := time.Now()
			insertProtectionReservation(t, ctx, db, testCourt, tc.status, now.Add(tc.start), now.Add(tc.end))
			err := courts.NewPostgresRepository(db).Delete(ctx, testComplex, testCourt, testActor, false)
			if !errors.Is(err, tc.want) {
				t.Fatalf("delete: got %v, want %v", err, tc.want)
			}
			var deleted bool
			var count int
			if err := db.QueryRow(ctx, `SELECT deleted_at IS NOT NULL FROM courts WHERE id=$1`, testCourt).Scan(&deleted); err != nil {
				t.Fatal(err)
			}
			if err := db.QueryRow(ctx, `SELECT count(*) FROM reservations WHERE court_id=$1`, testCourt).Scan(&count); err != nil {
				t.Fatal(err)
			}
			if deleted != (tc.want == nil) || count != 1 {
				t.Fatalf("deleted=%v reservations=%d", deleted, count)
			}
		})
	}
}

func TestReservationProtectionSchedule(t *testing.T) {
	loc, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name                   string
		reservation            bool
		status                 string
		opens, closes          string
		deleteWant, updateWant error
	}{
		{"without reservation", false, "", "10:00", "13:00", nil, nil},
		{"covered reservation", true, "reserved", "10:00", "13:00", ErrFutureReservations, nil},
		{"uncovered reservation", true, "reserved", "11:00", "13:00", ErrFutureReservations, ErrFutureReservations},
		{"cancelled reservation", true, "cancelled", "11:00", "13:00", nil, nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db, ctx := newScheduleTestDB(t)
			seedScheduleCourt(t, db, ctx)
			future := time.Now().In(loc).AddDate(0, 0, 7)
			start := time.Date(future.Year(), future.Month(), future.Day(), 10, 0, 0, 0, loc)
			weekday := int(start.Weekday())
			if weekday == 0 {
				weekday = 7
			}
			draft := scheduleDraft(weekday)
			repo := NewPostgresRepository(db)
			day, err := repo.Create(ctx, testComplex, testCourt, testActor, false, draft)
			if err != nil {
				t.Fatal(err)
			}
			if tc.reservation {
				insertProtectionReservation(t, ctx, db, testCourt, tc.status, start, start.Add(time.Hour))
			}
			changed := draft
			changed.Intervals = []Interval{{OpensAt: tc.opens, ClosesAt: tc.closes}}
			updated, err := repo.Update(ctx, testComplex, testCourt, testActor, false, day.Revision, changed)
			if !errors.Is(err, tc.updateWant) {
				t.Fatalf("update: got %v, want %v", err, tc.updateWant)
			}
			revision := day.Revision
			if err == nil {
				revision = updated.Revision
			}
			err = repo.Delete(ctx, testComplex, testCourt, testActor, false, weekday, revision)
			if !errors.Is(err, tc.deleteWant) {
				t.Fatalf("delete: got %v, want %v", err, tc.deleteWant)
			}
		})
	}
}
