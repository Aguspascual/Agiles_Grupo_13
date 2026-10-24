package auth

import (
	"errors"
	"fmt"
	"net/mail"
	"strings"
	"time"
)

var (
	ErrEmailTaken         = errors.New("email ya registrado")
	ErrInvalidCredentials = errors.New("credenciales inválidas")
)

var validZones = map[string]struct{}{
	"Casco Urbano": {}, "Gonnet": {}, "City Bell": {}, "San Carlos": {},
	"Tolosa": {}, "Villa Elisa": {}, "Berisso / Ensenada": {},
}

var validLevels = map[string]struct{}{
	"Principiante": {}, "8va": {}, "7ma": {}, "6ta": {}, "5ta": {},
	"4ta": {}, "3ra": {}, "2da": {}, "1ra": {},
}

var validPositions = map[string]struct{}{"Drive": {}, "Revés": {}, "Indistinto": {}}
var validHands = map[string]struct{}{"Diestro": {}, "Zurdo": {}}

type RegisterRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Password string `json:"password"`
	Zone     string `json:"zone"`
	Level    string `json:"level"`
	Position string `json:"position"`
	Hand     string `json:"hand"`
	FairPlay bool   `json:"fairPlay"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type User struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Zone     string `json:"zone"`
	Level    string `json:"level"`
	Position string `json:"position,omitempty"`
	Hand     string `json:"hand,omitempty"`
}

type Repository interface {
	CreateUser(name, email, passwordHash, zone, level, position, hand string, fairPlayAcceptedAt time.Time) (User, error)
	FindUserByEmail(email string) (User, string, error)
	FindUserByID(id string) (User, error)
}

func normalizeAndValidate(req *RegisterRequest) error {
	req.Name = strings.TrimSpace(req.Name)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Zone = strings.TrimSpace(req.Zone)
	req.Level = strings.TrimSpace(req.Level)
	req.Position = strings.TrimSpace(req.Position)
	req.Hand = strings.TrimSpace(req.Hand)
	if req.Name == "" || len(req.Name) > 120 {
		return fmt.Errorf("name es obligatorio y debe tener como máximo 120 caracteres")
	}
	address, err := mail.ParseAddress(req.Email)
	if len(req.Email) > 254 || err != nil || address.Address != req.Email {
		return fmt.Errorf("email inválido")
	}
	if len(req.Password) < 8 || len(req.Password) > 72 {
		return fmt.Errorf("password debe tener entre 8 y 72 caracteres")
	}
	if _, ok := validZones[req.Zone]; !ok {
		return fmt.Errorf("zone inválida")
	}
	if _, ok := validLevels[req.Level]; !ok {
		return fmt.Errorf("level inválido")
	}
	if req.Position != "" {
		if _, ok := validPositions[req.Position]; !ok {
			return fmt.Errorf("position inválida")
		}
	}
	if req.Hand != "" {
		if _, ok := validHands[req.Hand]; !ok {
			return fmt.Errorf("hand inválida")
		}
	}
	if !req.FairPlay {
		return fmt.Errorf("fairPlay debe ser aceptado")
	}
	return nil
}
