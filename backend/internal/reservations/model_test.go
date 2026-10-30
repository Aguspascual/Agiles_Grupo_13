package reservations

import (
	"net/url"
	"testing"
	"time"
)

func TestOwnReservationsDateQuery(t *testing.T) {
	location := time.FixedZone("Buenos Aires", -3*60*60)
	for _, tc := range []struct {
		name  string
		query url.Values
		valid bool
	}{
		{"valid", url.Values{"date": {"2026-11-03"}}, true},
		{"missing", url.Values{}, false},
		{"duplicate", url.Values{"date": {"2026-11-03", "2026-11-04"}}, false},
		{"invalid date", url.Values{"date": {"2026-02-30"}}, false},
		{"unknown parameter", url.Values{"date": {"2026-11-03"}, "userId": {"other"}}, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			start, end, err := parseOwnReservationsDate(tc.query, location)
			if (err == nil) != tc.valid {
				t.Fatalf("date query error = %v", err)
			}
			if tc.valid && (start.Format("2006-01-02 15:04") != "2026-11-03 00:00" || end.Format("2006-01-02 15:04") != "2026-11-04 00:00") {
				t.Fatalf("unexpected interval %v - %v", start, end)
			}
		})
	}
}

func TestReservationInput(t *testing.T) {
	location := time.FixedZone("Buenos Aires", -3*60*60)
	now := time.Date(2026, 11, 3, 17, 0, 0, 0, location)
	for _, tc := range []struct {
		name, date, start, contact, phone string
		valid                             bool
	}{
		{"valid", "2026-11-03", "18:00", " Ana ", " 123 ", true},
		{"empty contact", "2026-11-03", "18:00", " ", "123", false},
		{"invalid date", "2026-02-30", "18:00", "Ana", "123", false},
		{"past", "2026-11-03", "16:00", "Ana", "123", false},
		{"now", "2026-11-03", "17:00", "Ana", "123", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			in := Request{Date: tc.date, StartsAt: tc.start, Contact: Contact{Name: tc.contact, Phone: tc.phone}}
			_, err := in.validate(now, location)
			if (err == nil) != tc.valid {
				t.Fatalf("validate() error = %v", err)
			}
		})
	}
}
