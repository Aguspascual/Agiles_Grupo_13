package main

import (
	"net/http"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/complexes"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/courts"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/schedules"
	"github.com/jackc/pgx/v5/pgxpool"
)

func newHandler(db *pgxpool.Pool, secret []byte) http.Handler {
	service := auth.NewService(auth.NewPostgresRepository(db), secret)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	mux.Handle("POST /api/v1/auth/register", service.RegisterHandler())
	mux.Handle("POST /api/v1/auth/login", service.LoginHandler())
	mux.Handle("GET /api/v1/auth/me", service.MeHandler())
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
	return mux
}
