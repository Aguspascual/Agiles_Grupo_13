package schedules

import "context"

type Repository interface {
	List(context.Context, string, string, string, bool) ([]Day, error)
	Get(context.Context, string, string, string, bool, int) (Day, error)
	Create(context.Context, string, string, string, bool, Draft) (Day, error)
	Update(context.Context, string, string, string, bool, string, Draft) (Day, error)
	Delete(context.Context, string, string, string, bool, int, string) error
}

type RoleRepository interface {
	IsAdmin(context.Context, string) (bool, error)
}
