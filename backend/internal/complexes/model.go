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
	ImageData     []byte    `json:"-"`
	ImageMimeType string    `json:"-"`
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
	return nil
}
