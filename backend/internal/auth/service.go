package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	repository Repository
	jwtSecret  []byte
}

func NewService(repository Repository, jwtSecret []byte) *Service {
	return &Service{repository: repository, jwtSecret: append([]byte(nil), jwtSecret...)}
}

func (s *Service) RegisterHandler() http.Handler { return http.HandlerFunc(s.register) }
func (s *Service) LoginHandler() http.Handler    { return http.HandlerFunc(s.login) }
func (s *Service) MeHandler() http.Handler       { return http.HandlerFunc(s.me) }

func (s *Service) me(w http.ResponseWriter, r *http.Request) {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(header, "Bearer ") {
		writeError(w, http.StatusUnauthorized, "no autorizado")
		return
	}
	id, err := UserIDFromToken(strings.TrimSpace(strings.TrimPrefix(header, "Bearer ")), s.jwtSecret)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "no autorizado")
		return
	}
	user, err := s.repository.FindUserByID(id)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "no autorizado")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user})
}

func (s *Service) register(w http.ResponseWriter, r *http.Request) {
	var request RegisterRequest
	if !decodeJSON(w, r, &request) {
		return
	}
	if err := normalizeAndValidate(&request); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(request.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "no se pudo procesar la contraseña")
		return
	}
	user, err := s.repository.CreateUser(request.Name, request.Email, string(hash), request.Zone, request.Level, request.Position, request.Hand, time.Now().UTC())
	if errors.Is(err, ErrEmailTaken) {
		writeError(w, http.StatusConflict, "el email ya está registrado")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "no se pudo crear la cuenta")
		return
	}
	token, err := s.issueToken(user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "no se pudo iniciar sesión")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"user": user, "token": token})
}

func (s *Service) login(w http.ResponseWriter, r *http.Request) {
	var request LoginRequest
	if !decodeJSON(w, r, &request) {
		return
	}
	request.Email = strings.ToLower(strings.TrimSpace(request.Email))
	if request.Email == "" || request.Password == "" {
		writeError(w, http.StatusBadRequest, "email y password son obligatorios")
		return
	}
	user, hash, err := s.repository.FindUserByEmail(request.Email)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(request.Password)) != nil {
		writeError(w, http.StatusUnauthorized, "email o contraseña incorrectos")
		return
	}
	token, err := s.issueToken(user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "no se pudo iniciar sesión")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": user, "token": token})
}

func (s *Service) issueToken(userID string) (string, error) {
	if len(s.jwtSecret) < 32 {
		return "", fmt.Errorf("JWT_SECRET debe tener al menos 32 bytes")
	}
	encode := base64.RawURLEncoding.EncodeToString
	header, _ := json.Marshal(map[string]string{"alg": "HS256", "typ": "JWT"})
	claims, err := json.Marshal(map[string]any{"sub": userID, "iat": time.Now().Unix(), "exp": time.Now().Add(24 * time.Hour).Unix()})
	if err != nil {
		return "", err
	}
	unsigned := encode(header) + "." + encode(claims)
	mac := hmac.New(sha256.New, s.jwtSecret)
	_, _ = mac.Write([]byte(unsigned))
	return unsigned + "." + encode(mac.Sum(nil)), nil
}

func decodeJSON(w http.ResponseWriter, r *http.Request, destination any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		writeError(w, http.StatusBadRequest, "JSON inválido")
		return false
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		writeError(w, http.StatusBadRequest, "JSON inválido")
		return false
	}
	return true
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func WriteError(w http.ResponseWriter, status int, message string) { writeError(w, status, message) }

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func WriteJSON(w http.ResponseWriter, status int, value any) { writeJSON(w, status, value) }

func DecodeJSON(w http.ResponseWriter, r *http.Request, destination any) bool {
	return decodeJSON(w, r, destination)
}
