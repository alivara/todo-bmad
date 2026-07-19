//go:build testseed

// Integration coverage for the hard DeleteTodo (Story 2.3) against a live Postgres — the
// parameterized DELETE, the RowsAffected==0 → NotFoundError mapping (absent id), and the 22P02
// → NotFoundError mapping (malformed id) can only be exercised end-to-end (every unit test stubs
// the repo). Guarded by the `testseed` build tag; runs under `go test -tags testseed` with
// DATABASE_URL set (docker-compose.test.yml) and skips cleanly otherwise.
package repository

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/todo-app/api/model"
	"github.com/todo-app/api/testhelpers"
)

func TestDeleteTodo_Integration(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; integration test needs a live Postgres (docker-compose.test.yml)")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect to postgres: %v", err)
	}
	defer pool.Close()
	if err := testhelpers.ResetTodos(ctx, pool); err != nil {
		t.Fatalf("reset todos: %v", err)
	}
	repo := NewPostgres(pool)

	t.Run("existing id -> hard-deleted, gone from the list", func(t *testing.T) {
		created, err := repo.CreateTodo(ctx, "to delete", "")
		if err != nil {
			t.Fatalf("seed create: %v", err)
		}
		if err := repo.DeleteTodo(ctx, created.ID); err != nil {
			t.Fatalf("delete: %v", err)
		}
		todos, err := repo.ListTodos(ctx)
		if err != nil {
			t.Fatalf("list: %v", err)
		}
		for _, todo := range todos {
			if todo.ID == created.ID {
				t.Fatalf("todo %s still present after delete", created.ID)
			}
		}
	})

	t.Run("well-formed but absent id -> NotFoundError (RowsAffected==0, 404 not 500)", func(t *testing.T) {
		err := repo.DeleteTodo(ctx, "00000000-0000-0000-0000-000000000000")
		var nfe model.NotFoundError
		if !errors.As(err, &nfe) {
			t.Fatalf("want NotFoundError, got %v", err)
		}
	})

	t.Run("malformed (non-uuid) id -> NotFoundError, never a 500", func(t *testing.T) {
		err := repo.DeleteTodo(ctx, "not-a-uuid")
		var nfe model.NotFoundError
		if !errors.As(err, &nfe) {
			t.Fatalf("want NotFoundError for a malformed id (22P02), got %v", err)
		}
	})
}
