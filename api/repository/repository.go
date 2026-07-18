// Package repository is the persistence seam (AD-2). Every persistence operation is
// a method on the Repository interface; the Postgres implementation is the only place
// SQL lives (AD-1). The interface is kept clean today — NO speculative user_id/scope
// parameter — so multi-user can later be added by threading an owner scope through
// this one interface plus a `WHERE user_id = $1`, contained to repository + service.
package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/todo-app/api/model"
)

// Repository is the persistence contract the service depends on.
type Repository interface {
	// ListTodos returns all todos newest-first (created_at DESC, id DESC). It returns
	// a non-nil, possibly empty slice — never nil — so the handler serializes [] not null.
	ListTodos(ctx context.Context) ([]model.Todo, error)
	// Ping verifies the datastore is reachable (drives readiness at GET /health).
	Ping(ctx context.Context) error
}

// Postgres is the PostgreSQL-backed Repository. All SQL is parameterized (AD-10).
type Postgres struct {
	pool *pgxpool.Pool
}

// NewPostgres wraps a pgx pool as a Repository.
func NewPostgres(pool *pgxpool.Pool) *Postgres {
	return &Postgres{pool: pool}
}

// ListTodos implements Repository. Timestamps are scanned as native time.Time into the
// flat domain model; RFC3339 formatting + metadata nesting are the serializer's job. The
// slice is initialized non-nil so an empty table serializes as [] (AD-6), never null.
func (p *Postgres) ListTodos(ctx context.Context) ([]model.Todo, error) {
	const q = `
		SELECT id, title, description, status, created_at, updated_at
		FROM todos
		ORDER BY created_at DESC, id DESC`

	rows, err := p.pool.Query(ctx, q)
	if err != nil {
		return nil, fmt.Errorf("query todos: %w", err)
	}
	defer rows.Close()

	todos := make([]model.Todo, 0)
	for rows.Next() {
		var t model.Todo
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan todo: %w", err)
		}
		todos = append(todos, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate todos: %w", err)
	}
	return todos, nil
}

// Ping implements Repository.
func (p *Postgres) Ping(ctx context.Context) error {
	return p.pool.Ping(ctx)
}
