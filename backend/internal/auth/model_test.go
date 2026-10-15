package auth

import (
	"strings"
	"testing"
)

func TestNormalizeAndValidateAcceptsOnlyConfiguredZones(t *testing.T) {
	tests := []struct {
		zone string
		want bool
	}{
		{"Casco Urbano", true}, {" Gonnet ", true}, {"City Bell", true},
		{"San Carlos", true}, {"Tolosa", true}, {"Villa Elisa", true},
		{"Berisso / Ensenada", true}, {"La Plata", false}, {"", false},
	}
	for _, test := range tests {
		t.Run(test.zone, func(t *testing.T) {
			request := validRegisterRequest()
			request.Zone = test.zone
			err := normalizeAndValidate(&request)
			if (err == nil) != test.want {
				t.Fatalf("normalizeAndValidate(zone=%q) error = %v, want valid=%v", test.zone, err, test.want)
			}
			if test.want && request.Zone != strings.TrimSpace(test.zone) {
				t.Fatalf("zone was not trimmed: %q", request.Zone)
			}
		})
	}
}

func TestNormalizeAndValidateRequiresFairPlayAndKnownProfileValues(t *testing.T) {
	tests := []struct {
		name   string
		change func(*RegisterRequest)
	}{
		{"fair play", func(r *RegisterRequest) { r.FairPlay = false }},
		{"level", func(r *RegisterRequest) { r.Level = "Pro" }},
		{"position", func(r *RegisterRequest) { r.Position = "Any" }},
		{"hand", func(r *RegisterRequest) { r.Hand = "Ambidextrous" }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := validRegisterRequest()
			test.change(&request)
			if err := normalizeAndValidate(&request); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

func validRegisterRequest() RegisterRequest {
	return RegisterRequest{Name: "Jugador", Email: "jugador@example.com", Password: "password123", Zone: "Gonnet", Level: "7ma", FairPlay: true}
}
