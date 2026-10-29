package auth

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type PostgresRepository struct{ db *pgxpool.Pool }

func NewPostgresRepository(db *pgxpool.Pool) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (r *PostgresRepository) CreateUser(name, email, passwordHash, zone, level, position, hand string, fairPlayAcceptedAt time.Time) (User, error) {
	ctx := context.Background()
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return User{}, err
	}
	defer tx.Rollback(ctx)
	var user User
	err = tx.QueryRow(ctx, `INSERT INTO users (email, password_hash)
		VALUES ($1, $2) RETURNING id::text, email`, email, passwordHash).Scan(&user.ID, &user.Email)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return User{}, ErrEmailTaken
		}
		return User{}, err
	}
	err = tx.QueryRow(ctx, `INSERT INTO player_profiles (user_id, name, zone, level, position, hand, fair_play_accepted_at)
		VALUES ($1::uuid, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), $7)
		RETURNING name, zone, level, COALESCE(position, ''), COALESCE(hand, '')`,
		user.ID, name, zone, level, position, hand, fairPlayAcceptedAt).Scan(&user.Name, &user.Zone, &user.Level, &user.Position, &user.Hand)
	if err != nil {
		return User{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return User{}, err
	}
	return user, nil
}

func (r *PostgresRepository) FindUserByEmail(email string) (User, string, error) {
	var user User
	var passwordHash string
	err := r.db.QueryRow(context.Background(), `SELECT u.id::text, u.email, u.password_hash,
		p.name, p.zone, p.level, COALESCE(p.position, ''), COALESCE(p.hand, '')
		FROM users u JOIN player_profiles p ON p.user_id = u.id WHERE u.email = $1`, email).
		Scan(&user.ID, &user.Email, &passwordHash, &user.Name, &user.Zone, &user.Level, &user.Position, &user.Hand)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, "", ErrInvalidCredentials
	}
	return user, passwordHash, err
}

func (r *PostgresRepository) FindUserByID(id string) (User, error) {
	var user User
	err := r.db.QueryRow(context.Background(), `SELECT u.id::text, u.email, p.name, p.zone, p.level, COALESCE(p.position, ''), COALESCE(p.hand, '') FROM users u JOIN player_profiles p ON p.user_id = u.id WHERE u.id = $1`, id).
		Scan(&user.ID, &user.Email, &user.Name, &user.Zone, &user.Level, &user.Position, &user.Hand)
	return user, err
}

func (r *PostgresRepository) UpdateProfile(ctx context.Context, id, name, zone, level, position, hand string) (User, error) {
	var user User
	err := r.db.QueryRow(ctx, `WITH updated_profile AS (
		UPDATE player_profiles
		SET name=$2, zone=$3, level=$4, position=NULLIF($5, ''), hand=NULLIF($6, '')
		WHERE user_id=$1::uuid
		RETURNING user_id, name, zone, level, position, hand
	)
	SELECT u.id::text, p.name, u.email, p.zone, p.level, COALESCE(p.position, ''), COALESCE(p.hand, '')
	FROM updated_profile p JOIN users u ON u.id=p.user_id`, id, name, zone, level, position, hand).
		Scan(&user.ID, &user.Name, &user.Email, &user.Zone, &user.Level, &user.Position, &user.Hand)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrProfileNotFound
	}
	return user, err
}
