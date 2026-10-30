package slots

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/schedules"
)

type repositoryStub struct {
	snapshot  Snapshot
	err       error
	calls     int
	complexes []Complex
	listErr   error
}

func (r *repositoryStub) ListComplexes(context.Context) ([]Complex, error) {
	return r.complexes, r.listErr
}

func (r *repositoryStub) ReadAvailability(context.Context, string, time.Time, time.Time, int) (Snapshot, error) {
	r.calls++
	return r.snapshot, r.err
}

func TestGetValidatesStrictDateAndFourteenDayWindow(t *testing.T) {
	clock := func() time.Time { return time.Date(2026, 10, 29, 12, 0, 0, 0, time.FixedZone("-03", -3*60*60)) }
	repository := &repositoryStub{snapshot: Snapshot{Complex: Complex{ID: "8b1f0000-0000-4000-8000-000000000001"}, Courts: []CourtData{}}}
	service := NewServiceWithClock(repository, clock)
	complexID := "8b1f0000-0000-4000-8000-000000000001"
	for _, date := range []string{"2026-10-29", "2026-11-11"} {
		if _, err := service.Get(context.Background(), complexID, date); err != nil {
			t.Errorf("accepted boundary date %s: %v", date, err)
		}
	}
	for _, date := range []string{"2026-10-28", "2026-11-12", "2026-2-03", "2026-02-30", "2026-11-11T00:00:00"} {
		if _, err := service.Get(context.Background(), complexID, date); !errors.Is(err, ErrInvalid) {
			t.Errorf("date %q error=%v, want ErrInvalid", date, err)
		}
	}
	if _, err := service.Get(context.Background(), "complex-cumbre", "2026-10-29"); !errors.Is(err, ErrInvalid) {
		t.Errorf("synthetic complex ID error=%v, want ErrInvalid", err)
	}
	if repository.calls != 2 {
		t.Fatalf("repository called %d times for valid inputs, want 2", repository.calls)
	}
}

func TestDateWindowMovesAtBuenosAiresMidnight(t *testing.T) {
	location, err := time.LoadLocation(TimeZone)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 29, 23, 59, 59, 0, location)
	repository := &repositoryStub{snapshot: Snapshot{Complex: Complex{ID: "8b1f0000-0000-4000-8000-000000000001"}, Courts: []CourtData{}}}
	service := NewServiceWithClock(repository, func() time.Time { return now })
	complexID := "8b1f0000-0000-4000-8000-000000000001"
	if _, err := service.Get(context.Background(), complexID, "2026-11-11"); err != nil {
		t.Fatalf("last date in window before midnight should be accepted: %v", err)
	}

	now = time.Date(2026, 10, 30, 0, 0, 0, 0, location)
	if _, err := service.Get(context.Background(), complexID, "2026-10-29"); !errors.Is(err, ErrInvalid) {
		t.Fatalf("previous local date should become invalid after midnight, got %v", err)
	}
	if _, err := service.Get(context.Background(), complexID, "2026-11-12"); err != nil {
		t.Fatalf("new last date in window should be accepted: %v", err)
	}
	if _, err := service.Get(context.Background(), complexID, "2026-11-13"); !errors.Is(err, ErrInvalid) {
		t.Fatalf("date after new window should be invalid, got %v", err)
	}
	if repository.calls != 2 {
		t.Fatalf("repository called %d times, want only the two accepted dates", repository.calls)
	}
}

func TestHandlerRejectsExtraAndRepeatedQueryParameters(t *testing.T) {
	service := NewServiceWithClock(&repositoryStub{}, func() time.Time { return time.Date(2026, 10, 29, 12, 0, 0, 0, time.FixedZone("-03", -3*60*60)) })
	handler := service.Handler()
	path := "/api/v1/complexes/8b1f0000-0000-4000-8000-000000000001/slots"
	for _, query := range []string{"?date=2026-10-29&other=x", "?date=2026-10-29&date=2026-10-30"} {
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path+query, nil))
		if recorder.Code != http.StatusBadRequest || recorder.Header().Get("Cache-Control") != "no-store" {
			t.Errorf("query %q status=%d headers=%v body=%s", query, recorder.Code, recorder.Header(), recorder.Body.String())
		}
	}
}

func TestProjectionPreservesScheduleAndMarksDisabledOverlaps(t *testing.T) {
	location, err := time.LoadLocation(TimeZone)
	if err != nil {
		t.Fatal(err)
	}
	day := mustDate(t, "2026-10-31", location)
	intervals := []schedules.Interval{{OpensAt: "09:00", ClosesAt: "12:00"}}
	schedule := &schedules.Day{Weekday: 6, Enabled: false, DurationMinutes: 60, Intervals: intervals}
	court := CourtData{ID: "c41a0000-0000-4000-8000-000000000001", Schedule: schedule}
	reservations := []ReservationData{{CourtID: court.ID, StartsAt: day.Add(9*time.Hour + 30*time.Minute), EndsAt: day.Add(10*time.Hour + 30*time.Minute)}}
	got, err := projectCourt(court, reservations, day, location, day.Add(8*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Slots) != 3 || got.Slots[0].Status != "RESERVED" || got.Slots[1].Status != "RESERVED" || got.Slots[2].Status != "BLOCKED" {
		t.Fatalf("disabled day slots=%+v", got.Slots)
	}
	if len(schedule.Intervals) != 1 || schedule.Intervals[0].OpensAt != "09:00" {
		t.Fatalf("source schedule was changed: %+v", schedule)
	}
}

func TestHandlerMapsNotFoundAndInternalErrors(t *testing.T) {
	for _, test := range []struct {
		name string
		err  error
		want int
	}{{"not found", ErrNotFound, http.StatusNotFound}, {"database failure", errors.New("database unavailable"), http.StatusInternalServerError}} {
		t.Run(test.name, func(t *testing.T) {
			repository := &repositoryStub{err: test.err}
			service := NewServiceWithClock(repository, func() time.Time { return time.Date(2026, 10, 29, 12, 0, 0, 0, time.FixedZone("-03", -3*60*60)) })
			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/api/v1/complexes/8b1f0000-0000-4000-8000-000000000001/slots?date=2026-10-29", nil)
			service.Handler().ServeHTTP(recorder, request)
			if recorder.Code != test.want {
				t.Fatalf("status=%d want=%d body=%s", recorder.Code, test.want, recorder.Body.String())
			}
		})
	}
}

// TDD-0014: public complex directory.
func TestListHandlerReturnsComplexesWithoutStoring(t *testing.T) {
	repository := &repositoryStub{complexes: []Complex{{ID: "a", Name: "Norte", Address: "Calle 1", Zone: "Gonnet"}}}
	response := httptest.NewRecorder()
	NewService(repository).ListHandler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/public/complexes", nil))
	if response.Code != http.StatusOK || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("status=%d cache=%q", response.Code, response.Header().Get("Cache-Control"))
	}
	want := `{"complexes":[{"id":"a","name":"Norte","address":"Calle 1","zone":"Gonnet"}]}` + "\n"
	if response.Body.String() != want {
		t.Fatalf("body=%q want %q", response.Body.String(), want)
	}
}

func TestListHandlerReturnsEmptyArrayNeverNull(t *testing.T) {
	response := httptest.NewRecorder()
	NewService(&repositoryStub{}).ListHandler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/public/complexes", nil))
	if response.Code != http.StatusOK || response.Body.String() != `{"complexes":[]}`+ "\n" {
		t.Fatalf("status=%d body=%q", response.Code, response.Body.String())
	}
}

func TestListHandlerRejectsAnyQueryWithoutReadingRepository(t *testing.T) {
	for _, query := range []string{"?zone=Gonnet", "?", "?a=1&a=2"} {
		repository := &repositoryStub{}
		response := httptest.NewRecorder()
		NewService(repository).ListHandler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/public/complexes"+query, nil))
		if query == "?" {
			// An empty query string carries no parameters and is accepted.
			if response.Code != http.StatusOK {
				t.Errorf("query %q status=%d", query, response.Code)
			}
			continue
		}
		if response.Code != http.StatusBadRequest || response.Body.String() != `{"error":"consulta inválida"}`+ "\n" {
			t.Errorf("query %q status=%d body=%q", query, response.Code, response.Body.String())
		}
	}
}

func TestListHandlerHidesRepositoryErrors(t *testing.T) {
	response := httptest.NewRecorder()
	NewService(&repositoryStub{listErr: errors.New("secret dsn")}).ListHandler().ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/api/v1/public/complexes", nil))
	if response.Code != http.StatusInternalServerError || strings.Contains(response.Body.String(), "secret") {
		t.Fatalf("status=%d body=%q", response.Code, response.Body.String())
	}
}
