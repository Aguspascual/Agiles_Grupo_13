// Package catalog serves the public showcase of the home page: the courts of every active complex and
// the images of complexes and courts. It exposes no personal data and needs no session.
package catalog

import (
	"context"
	"errors"
	"net/http"

	"github.com/aguspascual/agiles_grupo_13/backend/internal/auth"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("image not found")

// Court is the public information of a court together with the complex it belongs to.
type Court struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	Covered        bool     `json:"covered"`
	Features       []string `json:"features"`
	ImageURL       string   `json:"imageUrl,omitempty"`
	ComplexID      string   `json:"complexId"`
	ComplexName    string   `json:"complexName"`
	ComplexZone    string   `json:"complexZone"`
	ComplexAddress string   `json:"complexAddress"`
}

// Image is a stored picture ready to be served.
type Image struct {
	Data     []byte
	MimeType string
}

type Repository interface {
	ListCourts(context.Context) ([]Court, error)
	ComplexImage(context.Context, string) (Image, error)
	CourtImage(context.Context, string) (Image, error)
}

type PostgresRepository struct{ db *pgxpool.Pool }

func NewPostgresRepository(db *pgxpool.Pool) *PostgresRepository { return &PostgresRepository{db: db} }

func (r *PostgresRepository) ListCourts(ctx context.Context) ([]Court, error) {
	rows, err := r.db.Query(ctx, `SELECT c.id::text, c.name, c.covered, c.has_lighting, c.has_electronic_scoreboard,
			c.has_wifi, c.has_acrylic_surface,
			CASE WHEN c.image_data IS NULL THEN '' ELSE '/api/v1/public/courts/'||c.id::text||'/image?v='||floor(extract(epoch from c.updated_at))::bigint END,
			x.id::text, x.name, x.zone, x.address
		FROM courts c JOIN complexes x ON x.id = c.complex_id
		WHERE c.deleted_at IS NULL AND x.deleted_at IS NULL
		ORDER BY x.name, c.name, c.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	courts := []Court{}
	for rows.Next() {
		var court Court
		var lighting, scoreboard, wifi, acrylic bool
		if err := rows.Scan(&court.ID, &court.Name, &court.Covered, &lighting, &scoreboard, &wifi, &acrylic,
			&court.ImageURL, &court.ComplexID, &court.ComplexName, &court.ComplexZone, &court.ComplexAddress); err != nil {
			return nil, err
		}
		court.Features = []string{}
		for _, feature := range []struct {
			id      string
			enabled bool
		}{{"lighting", lighting}, {"electronicScoreboard", scoreboard}, {"wifi", wifi}, {"acrylicSurface", acrylic}} {
			if feature.enabled {
				court.Features = append(court.Features, feature.id)
			}
		}
		courts = append(courts, court)
	}
	return courts, rows.Err()
}

func (r *PostgresRepository) ComplexImage(ctx context.Context, id string) (Image, error) {
	return r.image(ctx, `SELECT image_data, image_mime_type FROM complexes WHERE id=$1::uuid AND deleted_at IS NULL AND image_data IS NOT NULL`, id)
}

func (r *PostgresRepository) CourtImage(ctx context.Context, id string) (Image, error) {
	return r.image(ctx, `SELECT c.image_data, c.image_mime_type FROM courts c JOIN complexes x ON x.id=c.complex_id
		WHERE c.id=$1::uuid AND c.deleted_at IS NULL AND x.deleted_at IS NULL AND c.image_data IS NOT NULL`, id)
}

func (r *PostgresRepository) image(ctx context.Context, query, id string) (Image, error) {
	var image Image
	err := r.db.QueryRow(ctx, query, id).Scan(&image.Data, &image.MimeType)
	if errors.Is(err, pgx.ErrNoRows) {
		return Image{}, ErrNotFound
	}
	return image, err
}

type Service struct{ repository Repository }

func NewService(repository Repository) *Service { return &Service{repository: repository} }

// CourtsHandler serves GET /api/v1/public/courts.
func (s *Service) CourtsHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if len(r.URL.Query()) != 0 {
			auth.WriteError(w, http.StatusBadRequest, "consulta inválida")
			return
		}
		courts, err := s.repository.ListCourts(r.Context())
		if err != nil {
			auth.WriteError(w, http.StatusInternalServerError, "no se pudieron consultar las canchas")
			return
		}
		if courts == nil {
			courts = []Court{}
		}
		auth.WriteJSON(w, http.StatusOK, map[string]any{"courts": courts})
	})
}

// ComplexImageHandler serves GET /api/v1/public/complexes/{id}/image.
func (s *Service) ComplexImageHandler() http.Handler {
	return s.imageHandler(s.repository.ComplexImage)
}

// CourtImageHandler serves GET /api/v1/public/courts/{id}/image.
func (s *Service) CourtImageHandler() http.Handler {
	return s.imageHandler(s.repository.CourtImage)
}

func (s *Service) imageHandler(read func(context.Context, string) (Image, error)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !auth.ValidUUID(id) {
			auth.WriteError(w, http.StatusNotFound, "imagen no encontrada")
			return
		}
		image, err := read(r.Context(), id)
		if errors.Is(err, ErrNotFound) {
			auth.WriteError(w, http.StatusNotFound, "imagen no encontrada")
			return
		}
		if err != nil {
			auth.WriteError(w, http.StatusInternalServerError, "no se pudo consultar la imagen")
			return
		}
		w.Header().Set("Content-Type", image.MimeType)
		w.Header().Set("Cache-Control", "public, max-age=300")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(image.Data)
	})
}