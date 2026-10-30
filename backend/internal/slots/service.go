package slots

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

type Repository interface {
	ReadAvailability(context.Context, string, time.Time, time.Time, int) (Snapshot, error)
}

type Service struct {
	repository Repository
	clock      func() time.Time
	location   *time.Location
}

func NewService(repository Repository) *Service {
	return NewServiceWithClock(repository, time.Now)
}

func NewServiceWithClock(repository Repository, clock func() time.Time) *Service {
	location, err := time.LoadLocation(TimeZone)
	if err != nil {
		panic(err)
	}
	return &Service{repository: repository, clock: clock, location: location}
}

func (s *Service) Get(ctx context.Context, complexID, dateValue string) (Response, error) {
	if !auth.ValidUUID(complexID) || len(dateValue) != len("2006-01-02") {
		return Response{}, ErrInvalid
	}
	date, err := time.ParseInLocation("2006-01-02", dateValue, s.location)
	if err != nil || date.Format("2006-01-02") != dateValue {
		return Response{}, ErrInvalid
	}
	now := s.clock().In(s.location)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, s.location)
	if date.Before(today) || date.After(today.AddDate(0, 0, 13)) {
		return Response{}, ErrInvalid
	}
	dayStart := date
	dayEnd := dayStart.AddDate(0, 0, 1)
	weekday := int(date.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	snapshot, err := s.repository.ReadAvailability(ctx, complexID, dayStart, dayEnd, weekday)
	if err != nil {
		return Response{}, err
	}
	courts := make([]Court, 0, len(snapshot.Courts))
	for _, courtData := range snapshot.Courts {
		court, err := projectCourt(courtData, snapshot.Reservations, dayStart, s.location, now)
		if err != nil {
			return Response{}, err
		}
		courts = append(courts, court)
	}
	sort.Slice(courts, func(i, j int) bool {
		if courts[i].Name != courts[j].Name {
			return courts[i].Name < courts[j].Name
		}
		return courts[i].ID < courts[j].ID
	})
	return Response{Complex: snapshot.Complex, Date: dateValue, Courts: courts}, nil
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/complexes/{complexId}/slots", s.handleGet)
	return mux
}

func (s *Service) handleGet(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	query := r.URL.Query()
	dateValues, exists := query["date"]
	if len(query) != 1 || !exists || len(dateValues) != 1 {
		writeError(w, http.StatusBadRequest, "fecha inválida")
		return
	}
	result, err := s.Get(r.Context(), r.PathValue("complexId"), dateValues[0])
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalid):
			writeError(w, http.StatusBadRequest, "consulta de disponibilidad inválida")
		case errors.Is(err, ErrNotFound):
			writeError(w, http.StatusNotFound, "complejo no encontrado")
		default:
			writeError(w, http.StatusInternalServerError, "no se pudo consultar la disponibilidad")
		}
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(result)
}

func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
