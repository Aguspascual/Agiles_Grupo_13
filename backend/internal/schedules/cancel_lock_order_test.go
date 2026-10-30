package schedules

import (
	"errors"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/courts"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/reservations"
)

// Cancellation shares the court lock with schedule and court changes (TDD-0010/0016).
func TestCancelAndChangeBothLockOrders(t *testing.T) {
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	for _, policy := range []string{"player", "manager"} {
		for _, action := range []string{"court delete", "day delete", "interval update"} {
			for _, first := range []string{"cancel", "change"} {
				t.Run(policy+"/"+action+"/"+first+" first", func(t *testing.T) {
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
					reservationRepo := reservations.NewRepository(db)
					created, err := reservationRepo.Create(ctx, testComplex, testCourt, testActor,
						reservations.Request{Date: start.Format("2006-01-02"), StartsAt: "10:00", Contact: reservations.Contact{Name: "Test", Phone: "123"}}, start)
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
					cancelResult, changeResult := make(chan error, 1), make(chan error, 1)
					cancel := func() {
						go func() {
							var err error
							if policy == "player" {
								_, err = reservationRepo.CancelOwn(ctx, created.ID, testActor, location)
							} else {
								_, err = reservationRepo.CancelAsManager(ctx, testComplex, created.ID, testActor, location)
							}
							cancelResult <- err
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
					if first == "cancel" {
						cancel()
						waitForCourtWaiter(t, ctx, db, "%SELECT name FROM courts%FOR UPDATE%")
						change()
						waitForCourtWaiter(t, ctx, db, "%SELECT true FROM courts%FOR UPDATE%")
					} else {
						change()
						waitForCourtWaiter(t, ctx, db, "%SELECT true FROM courts%FOR UPDATE%")
						cancel()
						waitForCourtWaiter(t, ctx, db, "%SELECT name FROM courts%FOR UPDATE%")
					}
					if err := blocker.Commit(ctx); err != nil {
						t.Fatal(err)
					}
					cancelErr, changeErr := <-cancelResult, <-changeResult
					if cancelErr != nil {
						t.Fatalf("cancel failed: %v", cancelErr)
					}
					if first == "cancel" && changeErr != nil {
						t.Fatalf("change after cancel failed: %v", changeErr)
					}
					if first == "change" {
						if action == "court delete" && !errors.Is(changeErr, courts.ErrFutureReservations) {
							t.Fatalf("court change=%v", changeErr)
						}
						if action != "court delete" && !errors.Is(changeErr, ErrFutureReservations) {
							t.Fatalf("schedule change=%v", changeErr)
						}
					}
					var active int
					if err := db.QueryRow(ctx, `SELECT count(*) FROM reservations WHERE status='reserved'`).Scan(&active); err != nil || active != 0 {
						t.Fatalf("active=%d err=%v", active, err)
					}
				})
			}
		}
	}
}
