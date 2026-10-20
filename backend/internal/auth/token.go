package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

type contextKey string

const userIDContextKey contextKey = "authenticated-user-id"

var ErrInvalidToken = errors.New("invalid token")

// UserIDFromToken validates an HU-01 HS256 bearer token and returns its subject.
func UserIDFromToken(token string, secret []byte) (string, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "", ErrInvalidToken
	}
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write([]byte(parts[0] + "." + parts[1]))
	signature, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !hmac.Equal(signature, mac.Sum(nil)) {
		return "", ErrInvalidToken
	}
	headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
	var header struct {
		Algorithm string `json:"alg"`
		Type      string `json:"typ"`
	}
	if err != nil || json.Unmarshal(headerJSON, &header) != nil || header.Algorithm != "HS256" {
		return "", ErrInvalidToken
	}
	claimsJSON, err := base64.RawURLEncoding.DecodeString(parts[1])
	var claims struct {
		Subject string `json:"sub"`
		Expires int64  `json:"exp"`
	}
	if err != nil || json.Unmarshal(claimsJSON, &claims) != nil || claims.Subject == "" || claims.Expires <= time.Now().Unix() {
		return "", ErrInvalidToken
	}
	return claims.Subject, nil
}

type UserLookup interface {
	FindUserByID(id string) (User, error)
}

// RequireUser validates the token and confirms the subject still exists in PostgreSQL.
func RequireUser(secret []byte, users UserLookup, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := strings.TrimSpace(r.Header.Get("Authorization"))
		if !strings.HasPrefix(header, "Bearer ") {
			writeError(w, http.StatusUnauthorized, "no autorizado")
			return
		}
		id, err := UserIDFromToken(strings.TrimSpace(strings.TrimPrefix(header, "Bearer ")), secret)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "no autorizado")
			return
		}
		if _, err := users.FindUserByID(id); err != nil {
			writeError(w, http.StatusUnauthorized, "no autorizado")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userIDContextKey, id)))
	})
}

func UserIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(userIDContextKey).(string)
	return id, ok
}
