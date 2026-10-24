package courts

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	_ "golang.org/x/image/webp"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"net/http"
	"strings"
	"unicode/utf8"
)

const MaxImageSize = 5 << 20

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
	if dataURL == nil || *dataURL == "" {
		return nil, "", nil
	}
	parts := strings.SplitN(*dataURL, ",", 2)
	if len(parts) != 2 || !strings.HasPrefix(parts[0], "data:") || !strings.HasSuffix(parts[0], ";base64") {
		return nil, "", ErrInvalid
	}
	mimeType := strings.TrimSuffix(strings.TrimPrefix(parts[0], "data:"), ";base64")
	if mimeType != "image/png" && mimeType != "image/jpeg" && mimeType != "image/webp" {
		return nil, "", ErrInvalid
	}
	data, err := base64.StdEncoding.Strict().DecodeString(parts[1])
	if err != nil || len(data) == 0 || len(data) > MaxImageSize {
		return nil, "", ErrInvalid
	}
	detected := http.DetectContentType(data)
	if mimeType == "image/webp" {
		if len(data) < 12 || string(data[:4]) != "RIFF" || string(data[8:12]) != "WEBP" {
			return nil, "", ErrInvalid
		}
	} else if detected != mimeType {
		return nil, "", ErrInvalid
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 || (format != "png" && format != "jpeg" && format != "webp") {
		return nil, "", ErrInvalid
	}
	if config.Width > 8192 || config.Height > 8192 || int64(config.Width)*int64(config.Height) > 20_000_000 {
		return nil, "", ErrInvalid
	}
	if mimeType == "image/png" && format != "png" || mimeType == "image/jpeg" && format != "jpeg" || mimeType == "image/webp" && format != "webp" {
		return nil, "", ErrInvalid
	}
	if _, decodedFormat, err := image.Decode(bytes.NewReader(data)); err != nil || decodedFormat != format {
		return nil, "", ErrInvalid
	}
	return data, mimeType, nil
}

func dataURL(data []byte, mimeType string) *string {
	if len(data) == 0 {
		return nil
	}
	value := fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(data))
	return &value
}
