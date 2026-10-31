package complexes

import (
	"errors"
	"net/http"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

type Service struct{ repository Repository }

func NewService(repository Repository) *Service { return &Service{repository: repository} }

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/complexes", s.list)
	mux.HandleFunc("POST /api/v1/complexes", s.create)
	mux.HandleFunc("PUT /api/v1/complexes/{id}", s.update)
	mux.HandleFunc("DELETE /api/v1/complexes/{id}", s.delete)
	mux.HandleFunc("GET /api/v1/complexes/available-managers", s.availableManagers)
	return mux
}

func (s *Service) actor(w http.ResponseWriter, r *http.Request) (string, bool, bool) {
	id, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		auth.WriteError(w, http.StatusUnauthorized, "no autorizado")
		return "", false, false
	}
	admin, err := s.repository.IsAdmin(r.Context(), id)
	if err != nil {
		auth.WriteError(w, http.StatusInternalServerError, "no se pudo verificar permisos")
		return "", false, false
	}
	return id, admin, true
}

func (s *Service) list(w http.ResponseWriter, r *http.Request) {
	id, admin, ok := s.actor(w, r)
	if !ok {
		return
	}
	if !admin {
		assigned, err := s.repository.HasAssignments(r.Context(), id)
		if err != nil {
			auth.WriteError(w, 500, "no se pudieron verificar asignaciones")
			return
		}
		if !assigned {
			auth.WriteError(w, 403, "sin permisos para gestionar complejos")
			return
		}
	}
	items, err := s.repository.List(r.Context(), id, admin)
	if err != nil {
		writeRepositoryError(w, err)
		return
	}
	auth.WriteJSON(w, 200, map[string]any{"complexes": items})
}

func (s *Service) create(w http.ResponseWriter, r *http.Request) {
	_, admin, ok := s.actor(w, r)
	if !ok {
		return
	}
	if !admin {
		auth.WriteError(w, 403, "se requiere rol ADMIN")
		return
	}
	var draft Draft
	if !decodeDraft(w, r, &draft) {
		return
	}
	if err := draft.Validate(true); err != nil {
		auth.WriteError(w, 400, "datos de complejo inválidos")
		return
	}
	item, err := s.repository.Create(r.Context(), draft)
	if err != nil {
		writeRepositoryError(w, err)
		return
	}
	auth.WriteJSON(w, 201, map[string]any{"complex": item})
}

func (s *Service) update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !validUUID(id) {
		auth.WriteError(w, 400, "id inválido")
		return
	}
	actor, admin, ok := s.actor(w, r)
	if !ok {
		return
	}
	var draft Draft
	if !decodeDraft(w, r, &draft) {
		return
	}
	if err := draft.Validate(true); err != nil {
		auth.WriteError(w, 400, "datos de complejo inválidos")
		return
	}
	item, err := s.repository.Update(r.Context(), id, actor, admin, draft)
	if err != nil {
		writeRepositoryError(w, err)
		return
	}
	auth.WriteJSON(w, 200, map[string]any{"complex": item})
}

func decodeDraft(w http.ResponseWriter, r *http.Request, draft *Draft) bool {
	if err := auth.DecodeJSONWithLimit(w, r, draft, 7<<20); err != nil {
		message := "JSON inválido o demasiado grande"
		if errors.Is(err, auth.ErrTrailingJSON) {
			message = "JSON inválido"
		}
		auth.WriteError(w, http.StatusBadRequest, message)
		return false
	}
	return true
}

func (s *Service) delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !validUUID(id) {
		auth.WriteError(w, 400, "id inválido")
		return
	}
	_, admin, ok := s.actor(w, r)
	if !ok {
		return
	}
	if !admin {
		auth.WriteError(w, 403, "se requiere rol ADMIN")
		return
	}
	if err := s.repository.Delete(r.Context(), id); err != nil {
		writeRepositoryError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Service) availableManagers(w http.ResponseWriter, r *http.Request) {
	_, admin, ok := s.actor(w, r)
	if !ok {
		return
	}
	if !admin {
		auth.WriteError(w, 403, "se requiere rol ADMIN")
		return
	}
	managers, err := s.repository.AvailableManagers(r.Context())
	if err != nil {
		writeRepositoryError(w, err)
		return
	}
	auth.WriteJSON(w, 200, map[string]any{"managers": managers})
}

func validUUID(value string) bool { return auth.ValidUUID(value) }

func writeRepositoryError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrInvalid):
		auth.WriteError(w, 400, "datos de complejo inválidos")
	case errors.Is(err, ErrForbidden):
		auth.WriteError(w, 403, "sin permisos sobre este complejo")
	case errors.Is(err, ErrNotFound):
		auth.WriteError(w, 404, "complejo no encontrado")
	default:
		auth.WriteError(w, 500, "no se pudo completar la operación")
	}
}
