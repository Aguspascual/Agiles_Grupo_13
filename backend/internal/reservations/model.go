package reservations

import (
	"errors"
	"net/url"
	"strings"
	"time"
)

var (
	ErrInvalid   = errors.New("invalid reservation")
	ErrConflict  = errors.New("reservation conflict")
	ErrNotFound  = errors.New("resource not found")
	ErrForbidden = errors.New("reservation forbidden")
	ErrDuplicate = errors.New("duplicate invited player")
)

type Contact struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
}

type Request struct {
	Date     string  `json:"date"`
	StartsAt string  `json:"startsAt"`
	Contact  Contact `json:"contact"`
}

type Interval struct{ Open, Close string }

func parseOwnReservationsDate(query url.Values, location *time.Location) (time.Time, time.Time, error) {
	if len(query) != 1 || len(query["date"]) != 1 {
		return time.Time{}, time.Time{}, ErrInvalid
	}
	date := query.Get("date")
	start, err := time.ParseInLocation("2006-01-02", date, location)
	if err != nil || start.Format("2006-01-02") != date {
		return time.Time{}, time.Time{}, ErrInvalid
	}
	return start, start.AddDate(0, 0, 1), nil
}

func (r *Request) validate(now time.Time, location *time.Location) (time.Time, error) {
	r.Contact.Name = strings.TrimSpace(r.Contact.Name)
	r.Contact.Phone = strings.TrimSpace(r.Contact.Phone)
	if r.Contact.Name == "" || r.Contact.Phone == "" || minutes(r.StartsAt) < 0 {
		return time.Time{}, ErrInvalid
	}
	start, err := time.ParseInLocation("2006-01-02 15:04", r.Date+" "+r.StartsAt, location)
	if err != nil || start.Format("2006-01-02 15:04") != r.Date+" "+r.StartsAt {
		return time.Time{}, ErrInvalid
	}
	if !start.After(now) {
		return time.Time{}, ErrConflict
	}
	return start, nil
}

func minutes(value string) int {
	if len(value) != 5 || value[2] != ':' {
		return -1
	}
	for _, i := range []int{0, 1, 3, 4} {
		if value[i] < '0' || value[i] > '9' {
			return -1
		}
	}
	hour := int(value[0]-'0')*10 + int(value[1]-'0')
	minute := int(value[3]-'0')*10 + int(value[4]-'0')
	if hour > 23 || minute > 59 {
		return -1
	}
	return hour*60 + minute
}
