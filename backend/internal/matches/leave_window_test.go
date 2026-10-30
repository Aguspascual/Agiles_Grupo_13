package matches

import (
	"errors"
	"testing"
	"time"
)

func TestValidateLeaveWindowAllowsExactTwoHourBoundary(t *testing.T) {
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 11, 3, 18, 0, 0, 0, location)
	startsAt := now.Add(2 * time.Hour)

	if err := validateLeaveWindow(now, startsAt); err != nil {
		t.Fatalf("exact two-hour boundary rejected: %v", err)
	}
}

func TestValidateLeaveWindowRejectsAfterBoundaryAndAfterStart(t *testing.T) {
	location, err := time.LoadLocation("America/Argentina/Buenos_Aires")
	if err != nil {
		t.Fatal(err)
	}
	startsAt := time.Date(2026, 11, 3, 20, 0, 0, 0, location)
	for _, now := range []time.Time{startsAt.Add(-2*time.Hour + time.Nanosecond), startsAt} {
		if err := validateLeaveWindow(now, startsAt); !errors.Is(err, ErrTooLate) {
			t.Fatalf("validateLeaveWindow(%s) error=%v, want ErrTooLate", now, err)
		}
	}
}
