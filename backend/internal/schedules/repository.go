package schedules

import "context"

type Repository interface {
	List(context.Context, string, string, string, bool) ([]Day, error)
	Get(context.Context, string, string, string, bool, int) (Day, error)
	Create(context.Context, string, string, string, bool, Draft) (Day, error)
}

type RoleRepository interface {
	IsAdmin(context.Context, string) (bool, error)
}
