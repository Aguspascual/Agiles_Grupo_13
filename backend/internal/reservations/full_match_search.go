package reservations

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"unicode/utf8"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

const (
	minimumInviteSearchLength  = 6
	maximumInviteSearchLength  = 80
	maximumInviteSearchResults = 8
)

type InviteeSearchResult struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	EmailHint string `json:"emailHint"`
}

func (s *Service) searchInvitees(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	actorID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		auth.WriteError(w, http.StatusUnauthorized, "no autorizado")
		return
	}
	query, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil || len(query) != 1 || len(query["q"]) != 1 {
		auth.WriteError(w, http.StatusBadRequest, "solicitud inválida")
		return
	}
	search := strings.TrimSpace(query.Get("q"))
	length := utf8.RuneCountInString(search)
	if length < minimumInviteSearchLength || length > maximumInviteSearchLength {
		auth.WriteError(w, http.StatusBadRequest, "la búsqueda debe tener entre 6 y 80 caracteres")
		return
	}
	players, err := s.repository.SearchInvitees(r.Context(), actorID, search)
	if err != nil {
		auth.WriteError(w, http.StatusInternalServerError, "no se pudieron buscar jugadores")
		return
	}
	auth.WriteJSON(w, http.StatusOK, map[string]any{"players": players})
}

func (r *Repository) SearchInvitees(ctx context.Context, actorID, query string) ([]InviteeSearchResult, error) {
	escaped := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(query)
	pattern := "%" + escaped + "%"
	rows, err := r.db.Query(ctx, `SELECT u.id::text,p.name,u.email
		FROM users u JOIN player_profiles p ON p.user_id=u.id
		WHERE u.id <> $1::uuid AND (p.name ILIKE $2 ESCAPE E'\\' OR u.email ILIKE $2 ESCAPE E'\\')
		ORDER BY p.name,u.email LIMIT $3`, actorID, pattern, maximumInviteSearchResults)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	results := make([]InviteeSearchResult, 0, maximumInviteSearchResults)
	for rows.Next() {
		var result InviteeSearchResult
		var email string
		if err := rows.Scan(&result.ID, &result.Name, &email); err != nil {
			return nil, err
		}
		result.EmailHint = maskInviteEmail(email)
		results = append(results, result)
	}
	return results, rows.Err()
}

func maskInviteEmail(email string) string {
	local, domain, found := strings.Cut(email, "@")
	if !found || local == "" || domain == "" {
		return ""
	}
	localFirst, _ := utf8.DecodeRuneInString(local)
	domainName, suffix, hasSuffix := strings.Cut(domain, ".")
	domainFirst, _ := utf8.DecodeRuneInString(domainName)
	domainHint := string(domainFirst) + "•••"
	if hasSuffix {
		domainHint += "." + suffix
	}
	return string(localFirst) + "•••@" + domainHint
}
