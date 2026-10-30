package agenda

import (
	"context"
	"errors"
	"net/http"
	"time"
	_ "time/tzdata"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

const Path = "/api/v1/complexes/{complexId}/agenda"

type Reader interface {
	Read(ctx context.Context, complexID, actorID string, dayStart, dayEnd time.Time, weekday int) (Snapshot, error)
}

type Service struct {
	repository Reader
	clock      func() time.Time
	location   *time.Location
}

func NewService(repository Reader, clock func() time.Time) (*Service, error) {
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		return nil, err
	}
	return &Service{repository: repository, clock: clock, location: location}, nil
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET "+Path, s.get)
	return mux
}

func (s *Service) get(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	actor, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		auth.WriteError(w, http.StatusUnauthorized, "no autorizado")
		return
	}
	complexID := r.PathValue("complexId")
	query := r.URL.Query()
	values, exists := query["date"]
	if !auth.ValidUUID(complexID) || len(query) != 1 || !exists || len(values) != 1 {
		auth.WriteError(w, http.StatusBadRequest, "solicitud inválida")
		return
	}
	date, err := time.ParseInLocation("2006-01-02", values[0], s.location)
	now := s.clock().In(s.location)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, s.location)
	if err != nil || date.Format("2006-01-02") != values[0] || date.Before(today) || date.After(today.AddDate(0, 0, 13)) {
		auth.WriteError(w, http.StatusBadRequest, "solicitud inválida")
		return
	}
	weekday := int(date.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	snapshot, err := s.repository.Read(r.Context(), complexID, actor, date, date.AddDate(0, 0, 1), weekday)
	var response Response
	if err == nil {
		response, err = build(snapshot, date, s.location, now)
	}
	switch {
	case err == nil:
		auth.WriteJSON(w, http.StatusOK, response)
	case errors.Is(err, ErrForbidden):
		auth.WriteError(w, http.StatusForbidden, "sin permisos")
	case errors.Is(err, ErrNotFound):
		auth.WriteError(w, http.StatusNotFound, "complejo no encontrado")
	default:
		auth.WriteError(w, http.StatusInternalServerError, "no se pudo consultar la agenda")
	}
}
