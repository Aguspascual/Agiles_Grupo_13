package main

import (
	"net/http"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/agenda"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/catalog"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/complexes"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/courts"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/matches"
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
	matchService, matchErr := matches.NewServiceWithClock(matches.NewRepository(db), clock)
	if matchErr == nil {
		mux.Handle("GET "+matches.ListPath, matchService.ListHandler())
		mux.Handle("GET "+matches.OptionsPath, matchService.OptionsHandler())
		protectedMatches := auth.RequireUser(secret, auth.NewPostgresRepository(db), matchService.Handler())
		mux.Handle("POST "+matches.CreatePath, protectedMatches)
		mux.Handle("GET "+matches.GetPath, protectedMatches)
		mux.Handle("POST "+matches.JoinPath, protectedMatches)
		mux.Handle("DELETE "+matches.LeavePath, protectedMatches)
		mux.Handle("GET "+matches.NoticesPath, protectedMatches)
		mux.Handle("POST "+matches.NoticesPath+"/{noticeId}/read", protectedMatches)
	} else {
		mux.HandleFunc("GET "+matches.ListPath, func(w http.ResponseWriter, _ *http.Request) {
			auth.WriteError(w, http.StatusInternalServerError, "no se pudieron consultar los partidos")
		})
	}
	// The player-facing club directory is public: it exposes only id, name, address and zone (TDD-0014).
	mux.Handle("GET /api/v1/public/complexes", availabilityService.ListHandler())
	// Home page showcase: courts of every active complex and the pictures of complexes and courts.
	catalogService := catalog.NewService(catalog.NewPostgresRepository(db))
	mux.Handle("GET /api/v1/public/courts", catalogService.CourtsHandler())
	mux.Handle("GET /api/v1/public/complexes/{id}/image", catalogService.ComplexImageHandler())
	mux.Handle("GET /api/v1/public/courts/{id}/image", catalogService.CourtImageHandler())
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
	agendaService, agendaErr := agenda.NewService(agenda.NewRepository(db), clock)
	if agendaErr != nil {
		mux.HandleFunc("GET "+agenda.Path, func(w http.ResponseWriter, _ *http.Request) {
			auth.WriteError(w, http.StatusInternalServerError, "no se pudo consultar la agenda")
		})
	} else {
		mux.Handle("GET "+agenda.Path, auth.RequireUser(secret, auth.NewPostgresRepository(db), agendaService.Handler()))
	}
	reservationService, err := reservations.NewServiceWithClock(reservations.NewRepositoryWithClock(db, clock), clock)
	if err != nil {
		mux.HandleFunc("POST "+reservations.ManualPath, func(w http.ResponseWriter, _ *http.Request) {
			auth.WriteError(w, http.StatusInternalServerError, "no se pudo crear la reserva")
		})
		mux.HandleFunc("POST "+reservations.BasePath, func(w http.ResponseWriter, _ *http.Request) {
			auth.WriteError(w, http.StatusInternalServerError, "no se pudo crear la reserva")
		})
		mux.HandleFunc("POST "+reservations.CreateFullMatchPath, func(w http.ResponseWriter, _ *http.Request) {
			auth.WriteError(w, http.StatusInternalServerError, "no se pudo crear el partido")
		})
		mux.HandleFunc("GET "+reservations.InvitationPath, func(w http.ResponseWriter, _ *http.Request) {
			auth.WriteError(w, http.StatusInternalServerError, "no se pudo consultar la invitación")
		})
		mux.HandleFunc("GET "+reservations.OwnPath, func(w http.ResponseWriter, _ *http.Request) {
			auth.WriteError(w, http.StatusInternalServerError, "no se pudieron consultar las reservas")
		})
		mux.HandleFunc("GET "+reservations.MyPath, func(w http.ResponseWriter, _ *http.Request) {
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
		mux.Handle("GET "+reservations.InviteeSearchPath, protectedReservations)
		mux.Handle("GET "+reservations.InvitationPath, reservationService.PublicInvitationHandler())
		mux.Handle("POST "+reservations.BasePath, protectedReservations)
		mux.Handle("POST "+reservations.CreateFullMatchPath, protectedReservations)
		mux.Handle("GET "+reservations.FullMatchPath, protectedReservations)
		mux.Handle("POST "+reservations.InvitationPath+"/accept", protectedReservations)
		mux.Handle("POST "+reservations.ManualPath, protectedReservations)
		mux.Handle("POST "+reservations.OwnCancelPath, protectedReservations)
		mux.Handle("POST "+reservations.ManagerCancelPath, protectedReservations)
		mux.Handle("GET "+reservations.OwnPath, protectedReservations)
		mux.Handle("GET "+reservations.MyPath, protectedReservations)
		mux.Handle("GET "+reservations.NoticesPath, protectedReservations)
	}
	return mux
}
