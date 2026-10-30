package matches

import (
	"errors"
	"net/http"
	"time"
	_ "time/tzdata"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

type Service struct {
	repository *Repository
	location   *time.Location
	clock      func() time.Time
}

func NewService(repository *Repository) (*Service, error) {
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		return nil, err
	}
	return &Service{repository: repository, location: location, clock: time.Now}, nil
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST "+CreatePath, s.create)
	mux.HandleFunc("POST "+JoinPath, s.join)
	mux.HandleFunc("GET "+NoticesPath, s.listNotices)
	mux.HandleFunc("POST "+NoticesPath+"/{noticeId}/read", s.readNotice)
	return mux
}

func (s *Service) ListHandler() http.Handler { return http.HandlerFunc(s.list) }

func (s *Service) OptionsHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		items, err := s.repository.ListOptions(r.Context())
		if err != nil {
			auth.WriteError(w, http.StatusInternalServerError, "no se pudieron consultar los complejos")
			return
		}
		auth.WriteJSON(w, http.StatusOK, map[string]any{"complexes": items})
	})
}

func (s *Service) list(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	filters, err := ParseFilters(r.URL.Query(), s.location)
	if err != nil {
		auth.WriteError(w, http.StatusBadRequest, "filtros inválidos")
		return
	}
	filters.OnlyOpen = true
	items, err := s.repository.List(r.Context(), filters, s.clock(), s.location)
	if err != nil {
		auth.WriteError(w, http.StatusInternalServerError, "no se pudieron consultar los partidos")
		return
	}
	auth.WriteJSON(w, http.StatusOK, map[string]any{"matches": items})
}

func (s *Service) create(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	actor, ok := auth.UserIDFromContext(r.Context())
	complexID, courtID := r.PathValue("complexId"), r.PathValue("courtId")
	if !ok {
		auth.WriteError(w, http.StatusUnauthorized, "no autorizado")
		return
	}
	if !auth.ValidUUID(complexID) || !auth.ValidUUID(courtID) || r.URL.RawQuery != "" {
		auth.WriteError(w, http.StatusBadRequest, "solicitud inválida")
		return
	}
	var input CreateRequest
	if !auth.DecodeJSON(w, r, &input) {
		return
	}
	now := s.clock()
	start, err := input.Validate(now, s.location)
	if err == nil {
		var result Match
		result, err = s.repository.Create(r.Context(), complexID, courtID, actor, input, start, now, s.location)
		if err == nil {
			auth.WriteJSON(w, http.StatusCreated, map[string]any{"match": result})
			return
		}
	}
	s.writeError(w, err)
}

func (s *Service) join(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	actor, ok := auth.UserIDFromContext(r.Context())
	matchID := r.PathValue("matchId")
	if !ok {
		auth.WriteError(w, http.StatusUnauthorized, "no autorizado")
		return
	}
	if !auth.ValidUUID(matchID) || r.URL.RawQuery != "" {
		auth.WriteError(w, http.StatusBadRequest, "solicitud inválida")
		return
	}
	result, err := s.repository.Join(r.Context(), matchID, actor, s.clock(), s.location)
	if err != nil {
		s.writeError(w, err)
		return
	}
	auth.WriteJSON(w, http.StatusOK, map[string]any{"match": result})
}

func (s *Service) listNotices(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	actor, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		auth.WriteError(w, http.StatusUnauthorized, "no autorizado")
		return
	}
	if r.URL.RawQuery != "" {
		auth.WriteError(w, http.StatusBadRequest, "solicitud inválida")
		return
	}
	items, err := s.repository.UnreadNotices(r.Context(), actor)
	if err != nil {
		auth.WriteError(w, http.StatusInternalServerError, "no se pudieron consultar los avisos")
		return
	}
	auth.WriteJSON(w, http.StatusOK, map[string]any{"notices": items})
}

func (s *Service) readNotice(w http.ResponseWriter, r *http.Request) {
	actor, ok := auth.UserIDFromContext(r.Context())
	noticeID := r.PathValue("noticeId")
	if !ok {
		auth.WriteError(w, http.StatusUnauthorized, "no autorizado")
		return
	}
	if !auth.ValidUUID(noticeID) || r.URL.RawQuery != "" {
		auth.WriteError(w, http.StatusBadRequest, "solicitud inválida")
		return
	}
	if err := s.repository.ReadNotice(r.Context(), actor, noticeID); err != nil {
		s.writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Service) writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrInvalid):
		auth.WriteError(w, http.StatusBadRequest, "solicitud inválida")
	case errors.Is(err, ErrDuplicate):
		auth.WriteError(w, http.StatusConflict, "ya estás anotado en este partido")
	case errors.Is(err, ErrConflict):
		auth.WriteError(w, http.StatusConflict, "el partido o el horario ya no está disponible")
	case errors.Is(err, ErrNotFound):
		auth.WriteError(w, http.StatusNotFound, "recurso no encontrado")
	default:
		auth.WriteError(w, http.StatusInternalServerError, "no se pudo completar la operación")
	}
}
