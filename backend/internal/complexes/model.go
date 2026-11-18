package complexes

import (
	"errors"
	"strings"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/media"
)

var (
	ErrForbidden = errors.New("forbidden")
	ErrNotFound  = errors.New("not found")
	ErrInvalid   = errors.New("invalid complex")
)

var validZones = map[string]struct{}{
	"Casco Urbano": {}, "Gonnet": {}, "City Bell": {}, "San Carlos": {},
	"Tolosa": {}, "Villa Elisa": {}, "Berisso / Ensenada": {},
}

type Complex struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Address       string    `json:"address"`
	Zone          string    `json:"zone"`
	Phone         string    `json:"phone"`
	ImageDataURL  *string   `json:"imageDataUrl"`
	ManagerIDs    []string  `json:"managerIds"`
	Managers      []Manager `json:"managers,omitempty"`
	Pricing       Pricing   `json:"pricing"`
	ImageData     []byte    `json:"-"`
	ImageMimeType string    `json:"-"`
}

type Pricing struct {
	TurnPrice      DecimalAmount `json:"turnPrice"`
	DepositEnabled bool          `json:"depositEnabled"`
	DepositType    string        `json:"depositType"`
	DepositValue   DecimalAmount `json:"depositValue"`
}

type Manager struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

type Draft struct {
	Name         string   `json:"name"`
	Address      string   `json:"address"`
	Zone         string   `json:"zone"`
	Phone        string   `json:"phone"`
	ImageDataURL *string  `json:"imageDataUrl"`
	ManagerIDs   []string `json:"managerIds"`
	Pricing      *Pricing `json:"pricing,omitempty"`
}

func defaultPricing() Pricing { return Pricing{DepositType: "fixed"} }

func (p Pricing) Validate() error {
	if p.TurnPrice <= 0 || p.DepositValue < 0 {
		return ErrInvalid
	}
	switch p.DepositType {
	case "fixed":
		if p.DepositEnabled && (p.DepositValue <= 0 || p.DepositValue > p.TurnPrice) {
			return ErrInvalid
		}
		if !p.DepositEnabled && p.DepositValue > p.TurnPrice {
			return ErrInvalid
		}
	case "percentage":
		if p.DepositEnabled && (p.DepositValue < 100 || p.DepositValue > 10000) {
			return ErrInvalid
		}
		if !p.DepositEnabled && p.DepositValue > 0 && (p.DepositValue < 100 || p.DepositValue > 10000) {
			return ErrInvalid
		}
	default:
		return ErrInvalid
	}
	return nil
}

func (d *Draft) Validate(requireManagers bool) error {
	d.Name = strings.TrimSpace(d.Name)
	d.Address = strings.TrimSpace(d.Address)
	d.Zone = strings.TrimSpace(d.Zone)
	d.Phone = strings.TrimSpace(d.Phone)
	if _, _, err := media.DecodeDataURL(d.ImageDataURL); err != nil {
		return ErrInvalid
	}
	if d.Name == "" || len([]rune(d.Name)) > 80 || d.Address == "" || d.Phone == "" {
		return ErrInvalid
	}
	if _, ok := validZones[d.Zone]; !ok {
		return ErrInvalid
	}
	seen := make(map[string]struct{}, len(d.ManagerIDs))
	for _, id := range d.ManagerIDs {
		if !validUUID(id) {
			return ErrInvalid
		}
		if _, ok := seen[id]; ok {
			return ErrInvalid
		}
		seen[id] = struct{}{}
	}
	if requireManagers && len(d.ManagerIDs) == 0 {
		return ErrInvalid
	}
	if d.Pricing != nil && d.Pricing.Validate() != nil {
		return ErrInvalid
	}
	return nil
}
