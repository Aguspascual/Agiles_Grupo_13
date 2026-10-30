package schedules

import (
	"io"
	"net/http"
	"strings"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
)

type intervalInput struct {
	OpensAt  string `json:"opensAt"`
	ClosesAt string `json:"closesAt"`
}

type dayInput struct {
	Enabled         *bool            `json:"enabled"`
	DurationMinutes *int             `json:"durationMinutes"`
	Intervals       *[]intervalInput `json:"intervals"`
}

func readDraft(w http.ResponseWriter, r *http.Request, weekday int) (Draft, error) {
	var fields dayInput
	if weekday == 0 {
		var input struct {
			Weekday *int `json:"weekday"`
			dayInput
		}
		if err := decodeJSON(w, r, &input); err != nil {
			return Draft{}, err
		}
		if input.Weekday == nil {
			return Draft{}, ErrInvalid
		}
		weekday, fields = *input.Weekday, input.dayInput
	} else {
		if err := decodeJSON(w, r, &fields); err != nil {
			return Draft{}, err
		}
	}
	if fields.Enabled == nil || fields.DurationMinutes == nil || fields.Intervals == nil {
		return Draft{}, ErrInvalid
	}
	draft := Draft{Weekday: weekday, Enabled: *fields.Enabled, DurationMinutes: *fields.DurationMinutes, Intervals: make([]Interval, len(*fields.Intervals))}
	for index, interval := range *fields.Intervals {
		draft.Intervals[index] = Interval{OpensAt: interval.OpensAt, ClosesAt: interval.ClosesAt}
	}
	if err := draft.Validate(); err != nil {
		return Draft{}, err
	}
	return draft, nil
}

func decodeJSON(w http.ResponseWriter, r *http.Request, value any) error {
	if err := auth.DecodeJSONWithLimit(w, r, value, 64<<10); err != nil {
		return ErrInvalid
	}
	return nil
}

func requireEmptyBody(r *http.Request) error {
	if r.Body == nil {
		return nil
	}
	var buffer [1]byte
	n, err := r.Body.Read(buffer[:])
	if n != 0 || (err != nil && err != io.EOF) {
		return ErrInvalid
	}
	return nil
}

func validUUID(value string) bool { return auth.ValidUUID(value) }

func readRevision(r *http.Request) (string, error) {
	values := r.Header.Values("If-Match")
	if len(values) == 0 || (len(values) == 1 && strings.TrimSpace(values[0]) == "") {
		return "", ErrPreconditionRequired
	}
	if len(values) != 1 {
		return "", ErrInvalid
	}
	value := strings.TrimSpace(values[0])
	if len(value) != 38 || value[0] != '"' || value[37] != '"' || !validUUID(value[1:37]) {
		return "", ErrInvalid
	}
	return value[1:37], nil
}
