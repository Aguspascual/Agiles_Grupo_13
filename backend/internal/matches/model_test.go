package matches

import (
	"errors"
	"testing"
	"time"
)

func TestCreateRequestValidatesLevelsAndSlot(t *testing.T) {
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 30, 10, 0, 0, 0, location)
	base := func() CreateRequest { return CreateRequest{Date: "2026-11-02", StartsAt: "19:00", TargetLevel: "5ta"} }
	tests := []struct {
		name    string
		change  func(*CreateRequest)
		invalid bool
		levels  []string
	}{
		{"single legacy level", func(r *CreateRequest) {}, false, []string{"5ta"}},
		{"three levels", func(r *CreateRequest) { r.TargetLevels = []string{"5ta", "6ta", "7ma"} }, false, []string{"5ta", "6ta", "7ma"}},
		{"levels override the legacy one", func(r *CreateRequest) { r.TargetLevels = []string{"4ta", "5ta"} }, false, []string{"4ta", "5ta"}},
		{"four levels", func(r *CreateRequest) { r.TargetLevels = []string{"5ta", "6ta", "7ma", "8va"} }, true, nil},
		{"repeated level", func(r *CreateRequest) { r.TargetLevels = []string{"5ta", "5ta"} }, true, nil},
		{"unknown level", func(r *CreateRequest) { r.TargetLevels = []string{"5ta", "9na"} }, true, nil},
		{"no level", func(r *CreateRequest) { r.TargetLevel = "" }, true, nil},
		{"slot four", func(r *CreateRequest) { r.Slot = 4 }, false, []string{"5ta"}},
		{"slot five", func(r *CreateRequest) { r.Slot = 5 }, true, nil},
		{"negative slot", func(r *CreateRequest) { r.Slot = -1 }, true, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := base()
			tt.change(&request)
			_, err := request.Validate(now, location)
			if errors.Is(err, ErrInvalid) != tt.invalid {
				t.Fatalf("Validate()=%v, invalid=%v", err, tt.invalid)
			}
			if tt.invalid {
				return
			}
			if request.TargetLevel != tt.levels[0] || len(request.TargetLevels) != len(tt.levels) {
				t.Fatalf("TargetLevel=%q TargetLevels=%v want %v", request.TargetLevel, request.TargetLevels, tt.levels)
			}
		})
	}
}