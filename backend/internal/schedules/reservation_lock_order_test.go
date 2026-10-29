package schedules

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/courts"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/reservations"
	"github.com/jackc/pgx/v5/pgxpool"
)

// waitForCourtWaiter observes the actual blocked SQL statement before queuing
// the competing operation. Each test uses a dedicated PostgreSQL schema.
func waitForCourtWaiter(t *testing.T, ctx context.Context, db *pgxpool.Pool, query string) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		var waiting bool
		err := db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM pg_stat_activity
			WHERE datname=current_database() AND application_name=current_setting('application_name')
			AND wait_event_type='Lock' AND query LIKE $1)`, query).Scan(&waiting)
		if err != nil {
			t.Fatal(err)
		}
		if waiting {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("operation did not wait for court lock: %s", query)
}

func TestReservationAndChangeBothLockOrders(t *testing.T) {
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	for _, action := range []string{"court delete", "day delete", "interval update"} {
		for _, first := range []string{"reservation", "change"} {
			t.Run(action+"/"+first+" first", func(t *testing.T) {
				db, ctx := newScheduleTestDB(t)
				seedScheduleCourt(t, db, ctx)
				date := time.Now().In(location).AddDate(0, 0, 7)
				start := time.Date(date.Year(), date.Month(), date.Day(), 10, 0, 0, 0, location)
				weekday := int(start.Weekday())
				if weekday == 0 {
					weekday = 7
				}
				repo := NewPostgresRepository(db)
				draft := scheduleDraft(weekday)
				day, err := repo.Create(ctx, testComplex, testCourt, testActor, false, draft)
				if err != nil {
					t.Fatal(err)
				}
				blocker, err := db.Begin(ctx)
				if err != nil {
					t.Fatal(err)
				}
				defer blocker.Rollback(ctx)
				if _, err := blocker.Exec(ctx, `SELECT id FROM courts WHERE id=$1 FOR UPDATE`, testCourt); err != nil {
					t.Fatal(err)
				}
				bookResult, changeResult := make(chan error, 1), make(chan error, 1)
				book := func() {
					go func() {
						_, err := reservations.NewRepository(db).Create(ctx, testComplex, testCourt, testActor,
							reservations.Request{Date: start.Format("2006-01-02"), StartsAt: "10:00", Contact: reservations.Contact{Name: "Test", Phone: "123"}}, start)
						bookResult <- err
					}()
				}
				change := func() {
					go func() {
						var err error
						switch action {
						case "court delete":
							err = courts.NewPostgresRepository(db).Delete(ctx, testComplex, testCourt, testActor, false)
						case "day delete":
							err = repo.Delete(ctx, testComplex, testCourt, testActor, false, weekday, day.Revision)
						case "interval update":
							draft.Intervals = []Interval{{OpensAt: "11:00", ClosesAt: "13:00"}}
							_, err = repo.Update(ctx, testComplex, testCourt, testActor, false, day.Revision, draft)
						}
						changeResult <- err
					}()
				}
				if first == "reservation" {
					book()
					waitForCourtWaiter(t, ctx, db, "%SELECT name FROM courts%FOR UPDATE%")
					change()
					waitForCourtWaiter(t, ctx, db, "%SELECT true FROM courts%FOR UPDATE%")
				} else {
					change()
					waitForCourtWaiter(t, ctx, db, "%SELECT true FROM courts%FOR UPDATE%")
					book()
					waitForCourtWaiter(t, ctx, db, "%SELECT name FROM courts%FOR UPDATE%")
				}
				if err := blocker.Commit(ctx); err != nil {
					t.Fatal(err)
				}
				bookErr, changeErr := <-bookResult, <-changeResult
				if first == "reservation" {
					if bookErr != nil {
						t.Fatalf("first reservation failed: %v", bookErr)
					}
					if action == "court delete" && !errors.Is(changeErr, courts.ErrFutureReservations) {
						t.Fatalf("court change=%v", changeErr)
					}
					if action != "court delete" && !errors.Is(changeErr, ErrFutureReservations) {
						t.Fatalf("schedule change=%v", changeErr)
					}
				} else {
					if changeErr != nil {
						t.Fatalf("first change failed: %v", changeErr)
					}
					if !errors.Is(bookErr, reservations.ErrConflict) && !errors.Is(bookErr, reservations.ErrNotFound) {
						t.Fatalf("reservation=%v", bookErr)
					}
				}
				var count int
				if err := db.QueryRow(ctx, `SELECT count(*) FROM reservations WHERE court_id=$1 AND status='reserved'`, testCourt).Scan(&count); err != nil {
					t.Fatal(err)
				}
				if first == "reservation" && count != 1 || first == "change" && count != 0 {
					t.Fatalf("reservation count=%d", count)
				}
			})
		}
	}
}
