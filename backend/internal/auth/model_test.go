package auth

import (
	"strings"
	"testing"
)

// Shared UUID validation keeps the same accepted IDs across complex/court/schedule routes.
func TestValidUUIDShared(t *testing.T) {
	for _, tt := range []struct {
		value string
		valid bool
	}{
		{"11111111-1111-4111-8111-111111111111", true},
		{"ABCDEFAB-1111-7111-8111-111111111111", true},
		{"11111111-1111-0111-8111-111111111111", false},
		{"11111111-1111-4111-0111-111111111111", false},
		{"11111111111141118111111111111111", false},
		{"", false},
	} {
		if got := ValidUUID(tt.value); got != tt.valid {
			t.Errorf("ValidUUID(%q)=%v", tt.value, got)
		}
	}
}

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

func TestRegisterValidationPreservesEmailErrorPrecedence(t *testing.T) {
	request := validRegisterRequest()
	request.Email = "invalid"
	request.Zone = "unknown zone"
	if err := normalizeAndValidate(&request); err == nil || err.Error() != "email inválido" {
		t.Fatalf("validation error=%v, want email validation before profile catalog", err)
	}
}

func validRegisterRequest() RegisterRequest {
	return RegisterRequest{Name: "Jugador", Email: "jugador@example.com", Password: "password123", Zone: "Gonnet", Level: "7ma", FairPlay: true}
}
