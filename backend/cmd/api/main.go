package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/complexes"
	"github.com/aguspascual/agiles_grupo_13/backend/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	databaseURL := os.Getenv("DATABASE_URL")
	jwtSecret := os.Getenv("JWT_SECRET")
	if databaseURL == "" || jwtSecret == "" {
		log.Fatal("DATABASE_URL y JWT_SECRET son obligatorios")
	}
	if len(jwtSecret) < 32 {
		log.Fatal("JWT_SECRET debe tener al menos 32 bytes")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("conectar a PostgreSQL: %v", err)
	}
	defer db.Close()
	if err := db.Ping(ctx); err != nil {
		log.Fatalf("verificar PostgreSQL: %v", err)
	}
	if err := database.Migrate(ctx, db); err != nil {
		log.Fatalf("aplicar migraciones: %v", err)
	}

	service := auth.NewService(auth.NewPostgresRepository(db), []byte(jwtSecret))
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	mux.Handle("POST /api/v1/auth/register", service.RegisterHandler())
	mux.Handle("POST /api/v1/auth/login", service.LoginHandler())
	mux.Handle("GET /api/v1/auth/me", service.MeHandler())
	complexService := complexes.NewService(complexes.NewPostgresRepository(db))
	protectedComplexes := auth.RequireUser([]byte(jwtSecret), auth.NewPostgresRepository(db), complexService.Handler())
	mux.Handle("/api/v1/complexes", protectedComplexes)
	mux.Handle("/api/v1/complexes/", protectedComplexes)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	server := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	log.Printf("API escuchando en :%s", port)
	log.Fatal(server.ListenAndServe())
}
