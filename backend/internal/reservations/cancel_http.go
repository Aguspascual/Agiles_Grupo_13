package reservations

import (
	"errors"
	"io"
	"net/http"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

const OwnCancelPath = "/api/v1/reservations/{reservationId}/cancel"
const ManagerCancelPath = "/api/v1/complexes/{complexId}/reservations/{reservationId}/cancel"

func (s *Service) cancelOwn(w http.ResponseWriter, r *http.Request) {
	s.cancel(w, r, false)
}

func (s *Service) cancelAsManager(w http.ResponseWriter, r *http.Request) {
	s.cancel(w, r, true)
}

func (s *Service) cancel(w http.ResponseWriter, r *http.Request, manager bool) {
	w.Header().Set("Cache-Control", "no-store")
	actor, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		auth.WriteError(w, http.StatusUnauthorized, "no autorizado")
		return
	}
	complexID, reservationID := r.PathValue("complexId"), r.PathValue("reservationId")
	if !auth.ValidUUID(reservationID) || (manager && !auth.ValidUUID(complexID)) || r.URL.RawQuery != "" || hasBody(r) {
		auth.WriteError(w, http.StatusBadRequest, "solicitud inválida")
		return
	}
	var result Reservation
	var err error
	if manager {
		result, err = s.repository.CancelAsManager(r.Context(), complexID, reservationID, actor, s.location)
	} else {
		result, err = s.repository.CancelOwn(r.Context(), reservationID, actor, s.location)
	}
	switch {
	case err == nil:
		auth.WriteJSON(w, http.StatusOK, map[string]any{"reservation": result})
	case errors.Is(err, ErrNotFound):
		auth.WriteError(w, http.StatusNotFound, "recurso no encontrado")
	case errors.Is(err, ErrForbidden):
		auth.WriteError(w, http.StatusForbidden, "sin permisos")
	case errors.Is(err, ErrTooLate):
		auth.WriteError(w, http.StatusConflict, "fuera del plazo de cancelación")
	case errors.Is(err, ErrFinished):
		auth.WriteError(w, http.StatusConflict, "la reserva ya finalizó")
	default:
		auth.WriteError(w, http.StatusInternalServerError, "no se pudo cancelar la reserva")
	}
}

func hasBody(r *http.Request) bool {
	if r.Body == nil {
		return false
	}
	n, _ := io.CopyN(io.Discard, r.Body, 1)
	return n > 0
}
