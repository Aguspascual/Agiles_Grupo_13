package media

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
)

const MaxImageSize = 5 << 20

var ErrInvalidImage = errors.New("invalid image")

func DecodeDataURL(dataURL *string) ([]byte, string, error) {
	if dataURL == nil || *dataURL == "" {
		return nil, "", nil
	}
	parts := strings.SplitN(*dataURL, ",", 2)
	if len(parts) != 2 || !strings.HasPrefix(parts[0], "data:") || !strings.HasSuffix(parts[0], ";base64") {
		return nil, "", ErrInvalidImage
	}
	mimeType := strings.TrimSuffix(strings.TrimPrefix(parts[0], "data:"), ";base64")
	if mimeType != "image/png" && mimeType != "image/jpeg" && mimeType != "image/webp" {
		return nil, "", ErrInvalidImage
	}
	data, err := base64.StdEncoding.Strict().DecodeString(parts[1])
	if err != nil || len(data) == 0 || len(data) > MaxImageSize {
		return nil, "", ErrInvalidImage
	}
	detected := http.DetectContentType(data)
	if mimeType == "image/webp" {
		if len(data) < 12 || string(data[:4]) != "RIFF" || string(data[8:12]) != "WEBP" {
			return nil, "", ErrInvalidImage
		}
	} else if detected != mimeType {
		return nil, "", ErrInvalidImage
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 || (format != "png" && format != "jpeg" && format != "webp") {
		return nil, "", ErrInvalidImage
	}
	if config.Width > 8192 || config.Height > 8192 || int64(config.Width)*int64(config.Height) > 20_000_000 {
		return nil, "", ErrInvalidImage
	}
	if mimeType == "image/png" && format != "png" || mimeType == "image/jpeg" && format != "jpeg" || mimeType == "image/webp" && format != "webp" {
		return nil, "", ErrInvalidImage
	}
	if _, decodedFormat, err := image.Decode(bytes.NewReader(data)); err != nil || decodedFormat != format {
		return nil, "", ErrInvalidImage
	}
	return data, mimeType, nil
}

func EncodeDataURL(data []byte, mimeType string) *string {
	if len(data) == 0 {
		return nil
	}
	value := fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(data))
	return &value
}
