package courts

import (
	"context"
	"errors"
	"net/http"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

type RoleRepository interface {
	IsAdmin(context.Context, string) (bool, error)
}

type Service struct {
	repository Repository
	roles      RoleRepository
}

func NewService(repository Repository, roles RoleRepository) *Service {
	return &Service{repository: repository, roles: roles}
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/complexes/{complexId}/courts", s.list)
	mux.HandleFunc("POST /api/v1/complexes/{complexId}/courts", s.create)
	mux.HandleFunc("PUT /api/v1/complexes/{complexId}/courts/{courtId}", s.update)
	mux.HandleFunc("DELETE /api/v1/complexes/{complexId}/courts/{courtId}", s.delete)
	return mux
}

func (s *Service) actor(w http.ResponseWriter, r *http.Request) (string, bool, bool) {
	id, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		auth.WriteError(w, http.StatusUnauthorized, "no autorizado")
		return "", false, false
	}
	admin, err := s.roles.IsAdmin(r.Context(), id)
	if err != nil {
		auth.WriteError(w, http.StatusInternalServerError, "no se pudo verificar permisos")
		return "", false, false
	}
	return id, admin, true
}

func (s *Service) list(w http.ResponseWriter, r *http.Request) {
	complexID := r.PathValue("complexId")
	if !validUUID(complexID) {
		auth.WriteError(w, 400, "id de complejo inválido")
		return
	}
	actor, admin, ok := s.actor(w, r)
	if !ok {
		return
	}
	items, err := s.repository.List(r.Context(), complexID, actor, admin)
	if err != nil {
		writeError(w, err)
		return
	}
	auth.WriteJSON(w, 200, map[string]any{"courts": items})
}

func (s *Service) create(w http.ResponseWriter, r *http.Request) {
	complexID := r.PathValue("complexId")
	if !validUUID(complexID) {
		auth.WriteError(w, 400, "id de complejo inválido")
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
	if err := draft.Validate(); err != nil {
		auth.WriteError(w, 400, "datos de cancha inválidos")
		return
	}
	item, err := s.repository.Create(r.Context(), complexID, actor, admin, draft)
	if err != nil {
		writeError(w, err)
		return
	}
	auth.WriteJSON(w, 201, map[string]any{"court": item})
}

func (s *Service) update(w http.ResponseWriter, r *http.Request) {
	complexID, courtID := r.PathValue("complexId"), r.PathValue("courtId")
	if !validUUID(complexID) || !validUUID(courtID) {
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
	if err := draft.Validate(); err != nil {
		auth.WriteError(w, 400, "datos de cancha inválidos")
		return
	}
	item, err := s.repository.Update(r.Context(), complexID, courtID, actor, admin, draft)
	if err != nil {
		writeError(w, err)
		return
	}
	auth.WriteJSON(w, 200, map[string]any{"court": item})
}

func (s *Service) delete(w http.ResponseWriter, r *http.Request) {
	complexID, courtID := r.PathValue("complexId"), r.PathValue("courtId")
	if !validUUID(complexID) || !validUUID(courtID) {
		auth.WriteError(w, 400, "id inválido")
		return
	}
	actor, admin, ok := s.actor(w, r)
	if !ok {
		return
	}
	if err := s.repository.Delete(r.Context(), complexID, courtID, actor, admin); err != nil {
		writeError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func decodeDraft(w http.ResponseWriter, r *http.Request, draft *Draft) bool {
	if err := auth.DecodeJSONWithLimit(w, r, draft, 7<<20); err != nil {
		message := "JSON inválido o demasiado grande"
		if errors.Is(err, auth.ErrTrailingJSON) {
			message = "JSON inválido"
		}
		auth.WriteError(w, 400, message)
		return false
	}
	return true
}

func validUUID(value string) bool { return auth.ValidUUID(value) }

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrInvalid):
		auth.WriteError(w, 400, "datos de cancha inválidos")
	case errors.Is(err, ErrForbidden):
		auth.WriteError(w, 403, "sin permisos sobre este complejo")
	case errors.Is(err, ErrNotFound):
		auth.WriteError(w, 404, "complejo o cancha no encontrado")
	case errors.Is(err, ErrFutureReservations):
		auth.WriteError(w, 409, "no se puede dar de baja una cancha con reservas futuras")
	case errors.Is(err, ErrReservationSourceUnavailable):
		auth.WriteError(w, 503, "baja no disponible: la fuente de reservas reales aún no está integrada")
	default:
		auth.WriteError(w, 500, "no se pudo completar la operación")
	}
}
