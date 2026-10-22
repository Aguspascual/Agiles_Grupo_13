package courts

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// FutureReservationChecker must inspect real reservation records in the same
// transaction used to deactivate a court. Reservation creation must lock the
// same court row before inserting to prevent a check/delete race.
type FutureReservationChecker interface {
	HasFutureReservations(context.Context, pgx.Tx, string) (bool, error)
}

type unavailableReservationChecker struct{}

func (unavailableReservationChecker) HasFutureReservations(context.Context, pgx.Tx, string) (bool, error) {
	return false, ErrReservationSourceUnavailable
}

type Repository interface {
	List(context.Context, string, string, bool) ([]Court, error)
	Create(context.Context, string, string, bool, Draft) (Court, error)
	Update(context.Context, string, string, string, bool, Draft) (Court, error)
	Delete(context.Context, string, string, string, bool) error
}

type PostgresRepository struct {
	db           *pgxpool.Pool
	reservations FutureReservationChecker
}

func NewPostgresRepository(db *pgxpool.Pool) *PostgresRepository {
	return NewPostgresRepositoryWithReservationChecker(db, unavailableReservationChecker{})
}

func NewPostgresRepositoryWithReservationChecker(db *pgxpool.Pool, checker FutureReservationChecker) *PostgresRepository {
	if checker == nil {
		checker = unavailableReservationChecker{}
	}
	return &PostgresRepository{db: db, reservations: checker}
}

func (r *PostgresRepository) List(ctx context.Context, complexID, actorID string, admin bool) ([]Court, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if err := authorizeComplex(ctx, tx, complexID, actorID, admin); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, courtSelect+` WHERE complex_id=$1::uuid AND deleted_at IS NULL ORDER BY name,id`, complexID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Court{}
	for rows.Next() {
		item, err := scanCourt(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *PostgresRepository) Create(ctx context.Context, complexID, actorID string, admin bool, draft Draft) (Court, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Court{}, err
	}
	defer tx.Rollback(ctx)
	if err := authorizeComplex(ctx, tx, complexID, actorID, admin); err != nil {
		return Court{}, err
	}
	item, err := insertCourt(ctx, tx, complexID, draft)
	if err != nil {
		return Court{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Court{}, err
	}
	return item, nil
}

func (r *PostgresRepository) Update(ctx context.Context, complexID, courtID, actorID string, admin bool, draft Draft) (Court, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Court{}, err
	}
	defer tx.Rollback(ctx)
	if err := authorizeComplex(ctx, tx, complexID, actorID, admin); err != nil {
		return Court{}, err
	}
	imageData, mimeType, err := decodeImage(draft.ImageDataURL)
	if err != nil {
		return Court{}, err
	}
	_, err = tx.Exec(ctx, `UPDATE courts SET name=$3,covered=$4,has_lighting=$5,has_electronic_scoreboard=$6,has_wifi=$7,has_acrylic_surface=$8,image_data=$9,image_mime_type=$10,updated_at=now()
		WHERE id=$1::uuid AND complex_id=$2::uuid AND deleted_at IS NULL`, courtID, complexID, draft.Name, draft.Covered,
		featureEnabled(draft.Features, "lighting"), featureEnabled(draft.Features, "electronicScoreboard"), featureEnabled(draft.Features, "wifi"), featureEnabled(draft.Features, "acrylicSurface"), imageData, nullableString(mimeType))
	if err != nil {
		return Court{}, err
	}
	item, err := scanCourt(tx.QueryRow(ctx, courtSelect+` WHERE id=$1::uuid AND complex_id=$2::uuid AND deleted_at IS NULL`, courtID, complexID))
	if errors.Is(err, pgx.ErrNoRows) {
		return Court{}, ErrNotFound
	}
	if err != nil {
		return Court{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Court{}, err
	}
	return item, nil
}

func (r *PostgresRepository) Delete(ctx context.Context, complexID, courtID, actorID string, admin bool) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if err := authorizeComplex(ctx, tx, complexID, actorID, admin); err != nil {
		return err
	}
	var exists bool
	err = tx.QueryRow(ctx, `SELECT true FROM courts WHERE id=$1::uuid AND complex_id=$2::uuid AND deleted_at IS NULL FOR UPDATE`, courtID, complexID).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	hasFuture, err := r.reservations.HasFutureReservations(ctx, tx, courtID)
	if err != nil {
		return err
	}
	if hasFuture {
		return ErrFutureReservations
	}
	_, err = tx.Exec(ctx, `UPDATE courts SET deleted_at=now(),updated_at=now() WHERE id=$1::uuid AND complex_id=$2::uuid AND deleted_at IS NULL`, courtID, complexID)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

const courtSelect = `SELECT id::text,complex_id::text,name,covered,has_lighting,has_electronic_scoreboard,has_wifi,has_acrylic_surface,image_data,COALESCE(image_mime_type,'') FROM courts`

type rowScanner interface{ Scan(...any) error }

func scanCourt(row rowScanner) (Court, error) {
	var item Court
	var lighting, scoreboard, wifi, acrylic bool
	err := row.Scan(&item.ID, &item.ComplexID, &item.Name, &item.Covered, &lighting, &scoreboard, &wifi, &acrylic, &item.ImageData, &item.ImageMimeType)
	if err != nil {
		return Court{}, err
	}
	item.Features = []string{}
	if lighting {
		item.Features = append(item.Features, "lighting")
	}
	if scoreboard {
		item.Features = append(item.Features, "electronicScoreboard")
	}
	if wifi {
		item.Features = append(item.Features, "wifi")
	}
	if acrylic {
		item.Features = append(item.Features, "acrylicSurface")
	}
	item.ImageDataURL = dataURL(item.ImageData, item.ImageMimeType)
	return item, nil
}

func insertCourt(ctx context.Context, tx pgx.Tx, complexID string, draft Draft) (Court, error) {
	imageData, mimeType, err := decodeImage(draft.ImageDataURL)
	if err != nil {
		return Court{}, err
	}
	return scanCourt(tx.QueryRow(ctx, `INSERT INTO courts(complex_id,name,covered,has_lighting,has_electronic_scoreboard,has_wifi,has_acrylic_surface,image_data,image_mime_type)
		VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id::text,complex_id::text,name,covered,has_lighting,has_electronic_scoreboard,has_wifi,has_acrylic_surface,image_data,COALESCE(image_mime_type,'')`,
		complexID, draft.Name, draft.Covered, featureEnabled(draft.Features, "lighting"), featureEnabled(draft.Features, "electronicScoreboard"), featureEnabled(draft.Features, "wifi"), featureEnabled(draft.Features, "acrylicSurface"), imageData, nullableString(mimeType)))
}

func authorizeComplex(ctx context.Context, tx pgx.Tx, complexID, actorID string, admin bool) error {
	var exists bool
	err := tx.QueryRow(ctx, `SELECT true FROM complexes WHERE id=$1::uuid AND deleted_at IS NULL FOR SHARE`, complexID).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if admin {
		return nil
	}
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM complex_managers WHERE complex_id=$1::uuid AND user_id=$2::uuid)`, complexID, actorID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrForbidden
	}
	return nil
}

func featureEnabled(features []string, name string) bool {
	for _, feature := range features {
		if feature == name {
			return true
		}
	}
	return false
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}
