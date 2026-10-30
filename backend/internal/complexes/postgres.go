package complexes

import (
	"context"
	"errors"
	"sort"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository interface {
	IsAdmin(context.Context, string) (bool, error)
	HasAssignments(context.Context, string) (bool, error)
	List(context.Context, string, bool) ([]Complex, error)
	Create(context.Context, Draft) (Complex, error)
	Update(context.Context, string, string, bool, Draft) (Complex, error)
	Delete(context.Context, string) error
	AvailableManagers(context.Context) ([]Manager, error)
}

type PostgresRepository struct{ db *pgxpool.Pool }

func NewPostgresRepository(db *pgxpool.Pool) *PostgresRepository { return &PostgresRepository{db: db} }

// AuthorizeInTransaction checks active complex membership while retaining its shared lock.
// Callers supply their existing transaction so dependent writes remain indivisible.
func AuthorizeInTransaction(ctx context.Context, tx pgx.Tx, complexID, actorID string, admin bool) error {
	var exists bool
	err := tx.QueryRow(ctx, "SELECT true FROM complexes WHERE id=$1::uuid AND deleted_at IS NULL FOR SHARE", complexID).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if admin {
		return nil
	}
	err = tx.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM complex_managers WHERE complex_id=$1::uuid AND user_id=$2::uuid)", complexID, actorID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrForbidden
	}
	return nil
}

func (r *PostgresRepository) IsAdmin(ctx context.Context, userID string) (bool, error) {
	var admin bool
	err := r.db.QueryRow(ctx, `SELECT role = 'ADMIN' FROM users WHERE id = $1::uuid`, userID).Scan(&admin)
	return admin, err
}

func (r *PostgresRepository) HasAssignments(ctx context.Context, userID string) (bool, error) {
	var assigned bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM complex_managers WHERE user_id = $1::uuid)`, userID).Scan(&assigned)
	return assigned, err
}

func (r *PostgresRepository) List(ctx context.Context, userID string, admin bool) ([]Complex, error) {
	rows, err := r.db.Query(ctx, `SELECT c.id::text, c.name, c.address, c.zone, c.phone
		FROM complexes c
		WHERE c.deleted_at IS NULL AND ($2 OR EXISTS (
			SELECT 1 FROM complex_managers cm WHERE cm.complex_id = c.id AND cm.user_id = $1::uuid
		)) ORDER BY c.name, c.id`, userID, admin)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []Complex
	for rows.Next() {
		var item Complex
		if err := rows.Scan(&item.ID, &item.Name, &item.Address, &item.Zone, &item.Phone); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if result == nil {
		result = []Complex{}
	}
	for i := range result {
		ids, managers, err := r.complexManagers(ctx, result[i].ID)
		if err != nil {
			return nil, err
		}
		result[i].ManagerIDs, result[i].Managers = ids, managers
	}
	return result, nil
}

func (r *PostgresRepository) Create(ctx context.Context, draft Draft) (Complex, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Complex{}, err
	}
	defer tx.Rollback(ctx)
	var item Complex
	err = tx.QueryRow(ctx, `INSERT INTO complexes(name,address,zone,phone) VALUES($1,$2,$3,$4)
		RETURNING id::text,name,address,zone,phone`, draft.Name, draft.Address, draft.Zone, draft.Phone).
		Scan(&item.ID, &item.Name, &item.Address, &item.Zone, &item.Phone)
	if err != nil {
		return Complex{}, err
	}
	if err := insertManagers(ctx, tx, item.ID, draft.ManagerIDs); err != nil {
		return Complex{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Complex{}, err
	}
	item.ManagerIDs = append([]string(nil), draft.ManagerIDs...)
	item.Managers, _ = r.managerDetails(ctx, draft.ManagerIDs)
	return item, nil
}

func (r *PostgresRepository) Update(ctx context.Context, id, actor string, admin bool, draft Draft) (Complex, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Complex{}, err
	}
	defer tx.Rollback(ctx)
	var item Complex
	err = tx.QueryRow(ctx, `SELECT id::text,name,address,zone,phone FROM complexes
		WHERE id=$1::uuid AND deleted_at IS NULL FOR UPDATE`, id).
		Scan(&item.ID, &item.Name, &item.Address, &item.Zone, &item.Phone)
	if errors.Is(err, pgx.ErrNoRows) {
		return Complex{}, ErrNotFound
	}
	if err != nil {
		return Complex{}, err
	}
	if !admin {
		var assigned bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM complex_managers WHERE complex_id=$1::uuid AND user_id=$2::uuid)`, id, actor).Scan(&assigned); err != nil {
			return Complex{}, err
		}
		if !assigned {
			return Complex{}, ErrForbidden
		}
		current, err := managerIDsTx(ctx, tx, id)
		if err != nil {
			return Complex{}, err
		}
		requested := append([]string(nil), draft.ManagerIDs...)
		sort.Strings(current)
		sort.Strings(requested)
		if !equalStrings(current, requested) {
			return Complex{}, ErrForbidden
		}
	}
	_, err = tx.Exec(ctx, `UPDATE complexes SET name=$2,address=$3,zone=$4,phone=$5,updated_at=now() WHERE id=$1::uuid`, id, draft.Name, draft.Address, draft.Zone, draft.Phone)
	if err != nil {
		return Complex{}, err
	}
	if admin {
		if _, err := tx.Exec(ctx, `DELETE FROM complex_managers WHERE complex_id=$1::uuid`, id); err != nil {
			return Complex{}, err
		}
		if err := insertManagers(ctx, tx, id, draft.ManagerIDs); err != nil {
			return Complex{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return Complex{}, err
	}
	item.Name, item.Address, item.Zone, item.Phone = draft.Name, draft.Address, draft.Zone, draft.Phone
	item.ManagerIDs = append([]string(nil), draft.ManagerIDs...)
	item.Managers, _ = r.managerDetails(ctx, item.ManagerIDs)
	return item, nil
}

func (r *PostgresRepository) Delete(ctx context.Context, id string) error {
	result, err := r.db.Exec(ctx, `UPDATE complexes SET deleted_at=now(),updated_at=now() WHERE id=$1::uuid AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *PostgresRepository) AvailableManagers(ctx context.Context) ([]Manager, error) {
	rows, err := r.db.Query(ctx, `SELECT u.id::text,p.name,u.email FROM users u JOIN player_profiles p ON p.user_id=u.id ORDER BY p.name,u.email`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Manager{}
	for rows.Next() {
		var m Manager
		if err := rows.Scan(&m.ID, &m.Name, &m.Email); err != nil {
			return nil, err
		}
		result = append(result, m)
	}
	return result, rows.Err()
}

func insertManagers(ctx context.Context, tx pgx.Tx, complexID string, ids []string) error {
	for _, id := range ids {
		if _, err := tx.Exec(ctx, `INSERT INTO complex_managers(complex_id,user_id) SELECT $1::uuid,u.id FROM users u JOIN player_profiles p ON p.user_id=u.id WHERE u.id=$2::uuid`, complexID, id); err != nil {
			return err
		}
		var exists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM complex_managers WHERE complex_id=$1::uuid AND user_id=$2::uuid)`, complexID, id).Scan(&exists); err != nil {
			return err
		}
		if !exists {
			return ErrInvalid
		}
	}
	return nil
}

func managerIDsTx(ctx context.Context, tx pgx.Tx, complexID string) ([]string, error) {
	rows, err := tx.Query(ctx, `SELECT user_id::text FROM complex_managers WHERE complex_id=$1::uuid ORDER BY user_id`, complexID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func (r *PostgresRepository) complexManagers(ctx context.Context, complexID string) ([]string, []Manager, error) {
	rows, err := r.db.Query(ctx, `SELECT u.id::text,p.name,u.email FROM complex_managers cm JOIN users u ON u.id=cm.user_id JOIN player_profiles p ON p.user_id=u.id WHERE cm.complex_id=$1::uuid ORDER BY p.name,u.email`, complexID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	ids := []string{}
	managers := []Manager{}
	for rows.Next() {
		var m Manager
		if err := rows.Scan(&m.ID, &m.Name, &m.Email); err != nil {
			return nil, nil, err
		}
		ids = append(ids, m.ID)
		managers = append(managers, m)
	}
	return ids, managers, rows.Err()
}

func (r *PostgresRepository) managerDetails(ctx context.Context, ids []string) ([]Manager, error) {
	if len(ids) == 0 {
		return []Manager{}, nil
	}
	rows, err := r.db.Query(ctx, `SELECT u.id::text,p.name,u.email FROM users u JOIN player_profiles p ON p.user_id=u.id WHERE u.id::text=ANY($1) ORDER BY p.name,u.email`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Manager{}
	for rows.Next() {
		var m Manager
		if err := rows.Scan(&m.ID, &m.Name, &m.Email); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
