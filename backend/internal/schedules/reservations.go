package schedules

import (
	"context"
	"github.com/jackc/pgx/v5"
)

// FutureReservationChecker must inspect real records inside the supplied transaction,
// using America/Argentina/Buenos_Aires to match recurring weekdays and the server clock.
// Reservation writers must lock the same court row before confirming any interval.
// The checker must preserve existing bookings' actual start/end/duration.
type FutureReservationChecker interface {
	HasFutureReservations(context.Context, pgx.Tx, string, int) (bool, error)
	HasReservationsOutside(context.Context, pgx.Tx, string, int, []Interval) (bool, error)
}

type unavailableReservationChecker struct{}

func (unavailableReservationChecker) HasFutureReservations(context.Context, pgx.Tx, string, int) (bool, error) {
	return false, ErrReservationSourceUnavailable
}
func (unavailableReservationChecker) HasReservationsOutside(context.Context, pgx.Tx, string, int, []Interval) (bool, error) {
	return false, ErrReservationSourceUnavailable
}
