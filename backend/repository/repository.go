// Package repository is the persistence seam (AD-2). Every persistence operation is
// a method on the Repository interface; the Postgres implementation is the only place
// SQL lives (AD-1). The interface is kept clean today — NO speculative user_id/scope
// parameter — so multi-user can later be added by threading an owner scope through
// this one interface plus a `WHERE user_id = $1`, contained to repository + service.
package repository

import (
	"context"
	"fmt"
	"time"

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

// timeFormat is RFC3339 UTC second precision (AD-7), e.g. "2026-07-17T14:03:11Z".
func formatTS(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}

// ListTodos implements Repository. The slice is initialized non-nil so an empty
// table serializes as [] (AD-6), never null.
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
		var (
			t                    model.Todo
			createdAt, updatedAt time.Time
		)
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &createdAt, &updatedAt); err != nil {
			return nil, fmt.Errorf("scan todo: %w", err)
		}
		t.Metadata = model.Metadata{CreatedAt: formatTS(createdAt), UpdatedAt: formatTS(updatedAt)}
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
