package reservations

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

func StartFullMatchExpirationWorker(ctx context.Context, repository *Repository, interval time.Duration) {
	if interval <= 0 {
		interval = time.Minute
	}
	go func() {
		expire := func() {
			workerCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
			defer cancel()
			if _, err := repository.ExpireFullMatches(workerCtx, time.Now()); err != nil {
				log.Printf("HU-16: no se pudieron expirar invitaciones vencidas: %v", err)
			}
		}
		expire()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				expire()
			}
		}
	}()
}

func (s *Service) createFullMatch(w http.ResponseWriter, r *http.Request) {
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
	var input CreateFullMatchRequest
	if !auth.DecodeJSON(w, r, &input) {
		return
	}
	now := s.clock()
	start, err := input.Validate(now, s.location)
	if err == nil {
		var result FullMatch
		result, err = s.repository.CreateFullMatch(r.Context(), complexID, courtID, actor, input, start, now, s.location)
		if err == nil {
			auth.WriteJSON(w, http.StatusCreated, map[string]any{"match": result})
			return
		}
	}
	s.writeFullMatchError(w, err)
}

func (s *Service) getFullMatch(w http.ResponseWriter, r *http.Request) {
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
	if _, err := s.repository.ExpireFullMatches(r.Context(), s.clock()); err != nil {
		auth.WriteError(w, http.StatusInternalServerError, "no se pudo actualizar el estado del partido")
		return
	}
	result, err := s.repository.GetFullMatch(r.Context(), matchID, actor, s.location)
	if err != nil {
		s.writeFullMatchError(w, err)
		return
	}
	auth.WriteJSON(w, http.StatusOK, map[string]any{"match": result})
}

func (s *Service) getInvitation(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if r.URL.RawQuery != "" {
		auth.WriteError(w, http.StatusBadRequest, "solicitud inválida")
		return
	}
	if _, err := s.repository.ExpireFullMatches(r.Context(), s.clock()); err != nil {
		auth.WriteError(w, http.StatusInternalServerError, "no se pudo actualizar el estado de la invitación")
		return
	}
	result, err := s.repository.GetInvitation(r.Context(), r.PathValue("token"), s.clock(), s.location)
	if err != nil {
		s.writeFullMatchError(w, err)
		return
	}
	auth.WriteJSON(w, http.StatusOK, map[string]any{"match": result})
}

func (s *Service) acceptInvitation(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	actor, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		auth.WriteError(w, http.StatusUnauthorized, "no autorizado")
		return
	}
	if r.URL.RawQuery != "" || r.ContentLength > 0 {
		auth.WriteError(w, http.StatusBadRequest, "solicitud inválida")
		return
	}
	email, err := s.repository.inviteEmail(r.Context(), actor)
	if err == nil {
		var result FullMatch
		result, err = s.repository.AcceptInvitation(r.Context(), r.PathValue("token"), actor, email, s.clock(), s.location)
		if err == nil {
			for i := range result.Invites {
				result.Invites[i].Email = ""
			}
			auth.WriteJSON(w, http.StatusOK, map[string]any{"match": result})
			return
		}
	}
	s.writeFullMatchError(w, err)
}

func (s *Service) writeFullMatchError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrInvalid):
		auth.WriteError(w, http.StatusBadRequest, "datos de invitación inválidos")
	case errors.Is(err, ErrConflict):
		auth.WriteError(w, http.StatusConflict, "la invitación venció o el turno ya no está disponible")
	case errors.Is(err, ErrDuplicate):
		auth.WriteError(w, http.StatusConflict, "ya confirmaste otro lugar en este partido")
	case errors.Is(err, ErrForbidden):
		auth.WriteError(w, http.StatusForbidden, "esta invitación está dirigida a otro correo")
	case errors.Is(err, ErrNotFound):
		auth.WriteError(w, http.StatusNotFound, "invitación o partido no encontrado")
	default:
		auth.WriteError(w, http.StatusInternalServerError, "no se pudo completar la operación")
	}
}
