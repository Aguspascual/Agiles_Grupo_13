package courts

import (
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/media"
)

const MaxImageSize = media.MaxImageSize

var (
	ErrForbidden                    = errors.New("forbidden")
	ErrNotFound                     = errors.New("not found")
	ErrInvalid                      = errors.New("invalid court")
	ErrReservationSourceUnavailable = errors.New("reservation source unavailable")
	ErrFutureReservations           = errors.New("future reservations exist")
)

var featureNames = map[string]struct{}{
	"lighting": {}, "electronicScoreboard": {}, "wifi": {}, "acrylicSurface": {},
}

type Court struct {
	ID            string   `json:"id"`
	ComplexID     string   `json:"complexId"`
	Name          string   `json:"name"`
	Covered       bool     `json:"covered"`
	ImageDataURL  *string  `json:"imageDataUrl"`
	Features      []string `json:"features"`
	ImageData     []byte   `json:"-"`
	ImageMimeType string   `json:"-"`
}

type Draft struct {
	Name         string   `json:"name"`
	Covered      bool     `json:"covered"`
	ImageDataURL *string  `json:"imageDataUrl"`
	Features     []string `json:"features"`
}

func (d *Draft) Validate() error {
	d.Name = strings.TrimSpace(d.Name)
	if d.Name == "" || utf8.RuneCountInString(d.Name) > 40 {
		return ErrInvalid
	}
	seen := make(map[string]struct{}, len(d.Features))
	for _, feature := range d.Features {
		if _, ok := featureNames[feature]; !ok {
			return ErrInvalid
		}
		if _, ok := seen[feature]; ok {
			return ErrInvalid
		}
		seen[feature] = struct{}{}
	}
	if d.Features == nil {
		d.Features = []string{}
	}
	return nil
}

func decodeImage(dataURL *string) ([]byte, string, error) {
	data, mimeType, err := media.DecodeDataURL(dataURL)
	if errors.Is(err, media.ErrInvalidImage) {
		return nil, "", ErrInvalid
	}
	return data, mimeType, err
}

func dataURL(data []byte, mimeType string) *string {
	return media.EncodeDataURL(data, mimeType)
}
