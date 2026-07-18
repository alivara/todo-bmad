//go:build testseed

// Package testhelpers provides a test-only seed/reset seam through the datastore
// [TC1]. It is guarded by the `testseed` build tag so it is compiled ONLY into test
// builds (`go test -tags testseed` / a test-profile binary) and is NEVER reachable in
// the production api image, which is built without the tag. All SQL here is
// parameterized (AD-10) and runs against the same Postgres the repository uses, so
// integration/E2E can set list state and reset deterministically between runs.
package testhelpers

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/todo-app/api/model"
)

// SeedTodo is a minimal spec for inserting a known row in tests. Zero-value Status
// defaults to active. Timestamps are left to the DB unless explicitly needed later.
type SeedTodo struct {
	Title       string
	Description string
	Status      string
}

// ResetTodos truncates the todos table so each test starts from a clean, empty state.
func ResetTodos(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, `TRUNCATE TABLE todos`); err != nil {
		return fmt.Errorf("reset todos: %w", err)
	}
	return nil
}

// SeedTodos inserts the given rows (parameterized) and returns the generated ids in
// insertion order. Server defaults still apply (id, timestamps, status default).
func SeedTodos(ctx context.Context, pool *pgxpool.Pool, todos ...SeedTodo) ([]string, error) {
	ids := make([]string, 0, len(todos))
	for _, t := range todos {
		status := t.Status
		if status == "" {
			status = model.StatusActive
		}
		var id string
		err := pool.QueryRow(ctx,
			`INSERT INTO todos (title, description, status)
			 VALUES ($1, $2, $3)
			 RETURNING id`,
			t.Title, t.Description, status,
		).Scan(&id)
		if err != nil {
			return nil, fmt.Errorf("seed todo %q: %w", t.Title, err)
		}
		ids = append(ids, id)
	}
	return ids, nil
}
