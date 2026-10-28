package schedules

import (
	"net/http"
	"strconv"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

type Service struct {
	repository Repository
	roles      RoleRepository
}

func NewService(repository Repository, roles RoleRepository) *Service {
	return &Service{repository: repository, roles: roles}
}

const BasePath = "/api/v1/complexes/{complexId}/courts/{courtId}/weekly-schedule/days"

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET "+BasePath, s.list)
	mux.HandleFunc("GET "+BasePath+"/{weekday}", s.get)
	mux.HandleFunc("POST "+BasePath, s.create)
	return mux
}

type requestScope struct {
	complexID, courtID, actorID string
	weekday                     int
	admin                       bool
}

func (s *Service) request(w http.ResponseWriter, r *http.Request) (requestScope, bool) {
	w.Header().Set("Cache-Control", "no-store")
	actor, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		auth.WriteError(w, 401, "no autorizado")
		return requestScope{}, false
	}
	complexID, courtID := r.PathValue("complexId"), r.PathValue("courtId")
	if !validUUID(complexID) || !validUUID(courtID) || r.URL.RawQuery != "" {
		writeError(w, ErrInvalid)
		return requestScope{}, false
	}
	weekday := 0
	if raw := r.PathValue("weekday"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 || value > 7 || strconv.Itoa(value) != raw {
			writeError(w, ErrInvalid)
			return requestScope{}, false
		}
		weekday = value
	}
	admin, err := s.roles.IsAdmin(r.Context(), actor)
	if err != nil {
		writeError(w, err)
		return requestScope{}, false
	}
	// GET patterns also match HEAD. Preserve the previous empty HEAD response,
	// after the same validation and role lookup but without a repository read.
	if r.Method == http.MethodHead {
		return requestScope{}, false
	}
	return requestScope{complexID: complexID, courtID: courtID, actorID: actor, weekday: weekday, admin: admin}, true
}

func (s *Service) list(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.request(w, r)
	if !ok {
		return
	}
	if err := requireEmptyBody(r); err != nil {
		writeError(w, err)
		return
	}
	days, err := s.repository.List(r.Context(), scope.complexID, scope.courtID, scope.actorID, scope.admin)
	if err != nil {
		writeError(w, err)
		return
	}
	if days == nil {
		days = []Day{}
	}
	auth.WriteJSON(w, 200, map[string]any{"days": days})
}

func (s *Service) get(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.request(w, r)
	if !ok {
		return
	}
	if err := requireEmptyBody(r); err != nil {
		writeError(w, err)
		return
	}
	day, err := s.repository.Get(r.Context(), scope.complexID, scope.courtID, scope.actorID, scope.admin, scope.weekday)
	if err != nil {
		writeError(w, err)
		return
	}
	writeDay(w, 200, day)
}

func (s *Service) create(w http.ResponseWriter, r *http.Request) {
	scope, ok := s.request(w, r)
	if !ok {
		return
	}
	draft, err := readDraft(w, r, 0)
	if err != nil {
		writeError(w, err)
		return
	}
	day, err := s.repository.Create(r.Context(), scope.complexID, scope.courtID, scope.actorID, scope.admin, draft)
	if err != nil {
		writeError(w, err)
		return
	}
	w.Header().Set("Location", r.URL.Path+"/"+strconv.Itoa(day.Weekday))
	writeDay(w, 201, day)
}

func writeDay(w http.ResponseWriter, status int, day Day) {
	w.Header().Set("ETag", `"`+day.Revision+`"`)
	auth.WriteJSON(w, status, map[string]any{"day": day})
}
