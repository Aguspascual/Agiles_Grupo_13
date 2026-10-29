package reservations

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

const NoticesPath = "/api/v1/reservation-notices"

type Notice struct {
	ID          string          `json:"id"`
	Type        string          `json:"type"`
	CreatedAt   time.Time       `json:"createdAt"`
	Reservation json.RawMessage `json:"reservation"`
}

func (r *Repository) listNotices(ctx context.Context, actorID string) ([]Notice, error) {
	rows, err := r.db.Query(ctx, `SELECT id::text, kind, created_at, payload FROM reservation_notices WHERE user_id=$1::uuid ORDER BY created_at DESC, id DESC`, actorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Notice, 0)
	for rows.Next() {
		var item Notice
		if err := rows.Scan(&item.ID, &item.Type, &item.CreatedAt, &item.Reservation); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
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
	items, err := s.repository.listNotices(r.Context(), actor)
	if err != nil {
		auth.WriteError(w, http.StatusInternalServerError, "no se pudieron consultar los avisos")
		return
	}
	auth.WriteJSON(w, http.StatusOK, map[string]any{"notices": items})
}
