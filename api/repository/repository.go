// Package repository is the persistence seam (AD-2). Every persistence operation is
// a method on the Repository interface; the Postgres implementation is the only place
// SQL lives (AD-1). The interface is kept clean today — NO speculative user_id/scope
// parameter — so multi-user can later be added by threading an owner scope through
// this one interface plus a `WHERE user_id = $1`, contained to repository + service.
package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/todo-app/api/model"
)

// Repository is the persistence contract the service depends on.
type Repository interface {
	// ListTodos returns all todos newest-first (created_at DESC, id DESC). It returns
	// a non-nil, possibly empty slice — never nil — so the handler serializes [] not null.
	ListTodos(ctx context.Context) ([]model.Todo, error)
	// CreateTodo inserts a new todo (title + description already validated + trimmed by the
	// service) and returns the created row with the server-assigned id/status/timestamps
	// (AD-7). The interface stays clean — no owner/scope param (AD-2).
	CreateTodo(ctx context.Context, title, description string) (model.Todo, error)
	// UpdateTodo applies a partial update (AD-6): only the non-nil fields are written, plus
	// updated_at = now() (there is no DB trigger). All fields already validated + trimmed by
	// the service. Returns the full updated row (RETURNING). If no fields are provided it is a
	// no-op that returns the current row. A missing id yields model.NotFoundError. Interface
	// stays clean — no owner/scope param (AD-2).
	UpdateTodo(ctx context.Context, id string, title, description, status *string) (model.Todo, error)
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

// CreateTodo implements Repository. The INSERT supplies only title + description; the DB
// assigns id (gen_random_uuid()), status (DEFAULT 'active'), and created_at/updated_at
// (DEFAULT now()) — AD-7. RETURNING gives back the full row so the handler can emit the
// complete AD-6 resource in the 201 body. SQL is parameterized (AD-10).
func (p *Postgres) CreateTodo(ctx context.Context, title, description string) (model.Todo, error) {
	const q = `
		INSERT INTO todos (title, description)
		VALUES ($1, $2)
		RETURNING id, title, description, status, created_at, updated_at`

	var t model.Todo
	err := p.pool.QueryRow(ctx, q, title, description).
		Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return model.Todo{}, fmt.Errorf("insert todo: %w", err)
	}
	return t, nil
}

// UpdateTodo implements Repository. It builds a parameterized partial UPDATE from only the
// provided (non-nil) columns plus updated_at = now(), then RETURNING the full row so the
// handler can emit the complete AD-6 resource in the 200 body. Column names are a static
// whitelist (never interpolated from input); every VALUE is a bound parameter (AD-10) — no
// string-concatenation of values. A pgx.ErrNoRows (unknown id) maps to model.NotFoundError.
// With no fields to change it degrades to a SELECT of the current row (empty-patch no-op).
func (p *Postgres) UpdateTodo(ctx context.Context, id string, title, description, status *string) (model.Todo, error) {
	// Statically-whitelisted column names paired with their pointer value; only non-nil
	// fields contribute a SET clause. Placeholders are numbered so the id lands last.
	setClauses := make([]string, 0, 4)
	args := make([]any, 0, 5)
	argN := 1

	if title != nil {
		setClauses = append(setClauses, fmt.Sprintf("title = $%d", argN))
		args = append(args, *title)
		argN++
	}
	if description != nil {
		setClauses = append(setClauses, fmt.Sprintf("description = $%d", argN))
		args = append(args, *description)
		argN++
	}
	if status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", argN))
		args = append(args, *status)
		argN++
	}

	// Empty patch (all fields nil): nothing to change — return the current row unchanged so
	// the handler still emits a 200 + full resource (AD-6), and a missing id is still a 404.
	if len(setClauses) == 0 {
		const q = `
			SELECT id, title, description, status, created_at, updated_at
			FROM todos
			WHERE id = $1`
		var t model.Todo
		err := p.pool.QueryRow(ctx, q, id).
			Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.CreatedAt, &t.UpdatedAt)
		if err != nil {
			return model.Todo{}, todoByIDErr(err)
		}
		return t, nil
	}

	// Always bump updated_at on a real update (AD-7 — there is no DB trigger). The id is the
	// final positional parameter for the WHERE clause.
	setClauses = append(setClauses, "updated_at = now()")
	args = append(args, id)

	q := fmt.Sprintf(`
		UPDATE todos
		SET %s
		WHERE id = $%d
		RETURNING id, title, description, status, created_at, updated_at`,
		strings.Join(setClauses, ", "), argN)

	var t model.Todo
	err := p.pool.QueryRow(ctx, q, args...).
		Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return model.Todo{}, todoByIDErr(err)
	}
	return t, nil
}

// todoByIDErr translates a QueryRow error on a by-id todo operation into a domain error:
// ErrNoRows (absent id) and Postgres 22P02 (a malformed, non-uuid id — which can reference no
// resource) both become NotFoundError (404, not a 500, per AD-9); anything else is wrapped as
// an internal error.
func todoByIDErr(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return model.NotFoundError{Message: "todo not found"}
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "22P02" {
		return model.NotFoundError{Message: "todo not found"}
	}
	return fmt.Errorf("update todo: %w", err)
}

// Ping implements Repository.
func (p *Postgres) Ping(ctx context.Context) error {
	return p.pool.Ping(ctx)
}
