package main

import (
	"net/http"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/complexes"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/courts"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/reservations"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/schedules"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/slots"
	"github.com/jackc/pgx/v5/pgxpool"
)

func newHandler(db *pgxpool.Pool, secret []byte) http.Handler {
	return newHandlerWithClock(db, secret, time.Now)
}

func newHandlerWithClock(db *pgxpool.Pool, secret []byte, clock func() time.Time) http.Handler {
	service := auth.NewService(auth.NewPostgresRepository(db), secret)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	mux.Handle("POST /api/v1/auth/register", service.RegisterHandler())
	mux.Handle("POST /api/v1/auth/login", service.LoginHandler())
	mux.Handle("GET /api/v1/auth/me", service.MeHandler())
	mux.Handle("PUT /api/v1/auth/me", service.ProfileUpdateHandler())
	availabilityService := slots.NewServiceWithClock(slots.NewPostgresRepository(db), clock)
	// Public availability is the most specific complex route and must bypass auth.
	mux.Handle("GET /api/v1/complexes/{complexId}/slots", availabilityService.Handler())
	// The player-facing club directory is public: it exposes only id, name, address and zone (TDD-0014).
	mux.Handle("GET /api/v1/public/complexes", availabilityService.ListHandler())
	complexService := complexes.NewService(complexes.NewPostgresRepository(db))
	protectedComplexes := auth.RequireUser(secret, auth.NewPostgresRepository(db), complexService.Handler())
	mux.Handle("/api/v1/complexes", protectedComplexes)
	mux.Handle("/api/v1/complexes/", protectedComplexes)
	courtService := courts.NewService(courts.NewPostgresRepository(db), complexes.NewPostgresRepository(db))
	protectedCourts := auth.RequireUser(secret, auth.NewPostgresRepository(db), courtService.Handler())
	mux.Handle("GET /api/v1/complexes/{complexId}/courts", protectedCourts)
	mux.Handle("POST /api/v1/complexes/{complexId}/courts", protectedCourts)
	mux.Handle("PUT /api/v1/complexes/{complexId}/courts/{courtId}", protectedCourts)
	mux.Handle("DELETE /api/v1/complexes/{complexId}/courts/{courtId}", protectedCourts)
	scheduleService := schedules.NewService(schedules.NewPostgresRepository(db), complexes.NewPostgresRepository(db))
	protectedSchedules := auth.RequireUser(secret, auth.NewPostgresRepository(db), scheduleService.Handler())
	for _, pattern := range []string{"POST " + schedules.BasePath, "GET " + schedules.BasePath,
		"GET " + schedules.BasePath + "/{weekday}", "PUT " + schedules.BasePath + "/{weekday}",
		"DELETE " + schedules.BasePath + "/{weekday}"} {
		mux.Handle(pattern, protectedSchedules)
	}
	reservationService, err := reservations.NewService(reservations.NewRepositoryWithClock(db, clock))
	if err != nil {
		mux.HandleFunc("POST "+reservations.ManualPath, func(w http.ResponseWriter, _ *http.Request) {
			auth.WriteError(w, http.StatusInternalServerError, "no se pudo crear la reserva")
		})
		mux.HandleFunc("POST "+reservations.BasePath, func(w http.ResponseWriter, _ *http.Request) {
			auth.WriteError(w, http.StatusInternalServerError, "no se pudo crear la reserva")
		})
		mux.HandleFunc("GET "+reservations.OwnPath, func(w http.ResponseWriter, _ *http.Request) {
			auth.WriteError(w, http.StatusInternalServerError, "no se pudieron consultar las reservas")
		})
		for _, path := range []string{reservations.OwnCancelPath, reservations.ManagerCancelPath} {
			mux.HandleFunc("POST "+path, func(w http.ResponseWriter, _ *http.Request) {
				auth.WriteError(w, http.StatusInternalServerError, "no se pudo cancelar la reserva")
			})
		}
		mux.HandleFunc("GET "+reservations.NoticesPath, func(w http.ResponseWriter, _ *http.Request) {
			auth.WriteError(w, http.StatusInternalServerError, "no se pudieron consultar los avisos")
		})
	} else {
		protectedReservations := auth.RequireUser(secret, auth.NewPostgresRepository(db), reservationService.Handler())
		mux.Handle("POST "+reservations.BasePath, protectedReservations)
		mux.Handle("POST "+reservations.ManualPath, protectedReservations)
		mux.Handle("POST "+reservations.OwnCancelPath, protectedReservations)
		mux.Handle("POST "+reservations.ManagerCancelPath, protectedReservations)
		mux.Handle("GET "+reservations.OwnPath, protectedReservations)
		mux.Handle("GET "+reservations.NoticesPath, protectedReservations)
	}
	return mux
}
