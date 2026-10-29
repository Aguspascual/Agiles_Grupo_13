package auth

import (
	"errors"
	"fmt"
	"net/mail"
	"regexp"
	"strings"
	"time"
)

var uuidPattern = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

// ValidUUID keeps identifier validation consistent across authenticated resources.
func ValidUUID(value string) bool { return uuidPattern.MatchString(value) }

var (
	ErrEmailTaken         = errors.New("email ya registrado")
	ErrInvalidCredentials = errors.New("credenciales inválidas")
	ErrProfileNotFound    = errors.New("perfil no encontrado")
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

// UpdateProfileRequest keeps pointers so omitted and null values are rejected.
type UpdateProfileRequest struct {
	Name     *string `json:"name"`
	Zone     *string `json:"zone"`
	Level    *string `json:"level"`
	Position *string `json:"position"`
	Hand     *string `json:"hand"`
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
	if err := validateProfileName(req.Name); err != nil {
		return err
	}
	address, err := mail.ParseAddress(req.Email)
	if len(req.Email) > 254 || err != nil || address.Address != req.Email {
		return fmt.Errorf("email inválido")
	}
	if len(req.Password) < 8 || len(req.Password) > 72 {
		return fmt.Errorf("password debe tener entre 8 y 72 caracteres")
	}
	if err := validateProfileValues(req.Zone, req.Level, req.Position, req.Hand); err != nil {
		return err
	}
	if !req.FairPlay {
		return fmt.Errorf("fairPlay debe ser aceptado")
	}
	return nil
}

func normalizeAndValidateProfile(name, zone, level, position, hand *string) error {
	*name = strings.TrimSpace(*name)
	*zone = strings.TrimSpace(*zone)
	*level = strings.TrimSpace(*level)
	*position = strings.TrimSpace(*position)
	*hand = strings.TrimSpace(*hand)
	if err := validateProfileName(*name); err != nil {
		return err
	}
	return validateProfileValues(*zone, *level, *position, *hand)
}

func validateProfileName(name string) error {
	if name == "" || len(name) > 120 {
		return fmt.Errorf("name es obligatorio y debe tener como máximo 120 caracteres")
	}
	return nil
}

func validateProfileValues(zone, level, position, hand string) error {
	if _, ok := validZones[zone]; !ok {
		return fmt.Errorf("zone inválida")
	}
	if _, ok := validLevels[level]; !ok {
		return fmt.Errorf("level inválido")
	}
	if position != "" {
		if _, ok := validPositions[position]; !ok {
			return fmt.Errorf("position inválida")
		}
	}
	if hand != "" {
		if _, ok := validHands[hand]; !ok {
			return fmt.Errorf("hand inválida")
		}
	}
	return nil
}
