//go:build testseed

// Integration coverage for the partial UpdateTodo (Story 2.1) against a live Postgres — the
// dynamic $n SET-builder and the by-id error mapping (ErrNoRows / 22P02 → NotFoundError) can
// only be exercised end-to-end (every unit test stubs the repo). Guarded by the `testseed`
// build tag; runs under `go test -tags testseed` with DATABASE_URL set (docker-compose.test.yml)
// and skips cleanly otherwise.
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

func TestUpdateTodo_Integration(t *testing.T) {
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

	created, err := repo.CreateTodo(ctx, "original title", "original desc")
	if err != nil {
		t.Fatalf("seed create: %v", err)
	}

	t.Run("multi-field partial update applies all fields + bumps updatedAt, stable identity", func(t *testing.T) {
		newTitle, newDesc, newStatus := "edited title", "edited desc", model.StatusCompleted
		updated, err := repo.UpdateTodo(ctx, created.ID, &newTitle, &newDesc, &newStatus)
		if err != nil {
			t.Fatalf("update: %v", err)
		}
		if updated.Title != newTitle || updated.Description != newDesc || updated.Status != newStatus {
			t.Errorf("provided fields not applied: got %+v", updated)
		}
		if !updated.UpdatedAt.After(created.UpdatedAt) {
			t.Errorf("updatedAt must be bumped: created=%v updated=%v", created.UpdatedAt, updated.UpdatedAt)
		}
		if updated.ID != created.ID || !updated.CreatedAt.Equal(created.CreatedAt) {
			t.Errorf("id/createdAt must be stable across an update")
		}
	})

	t.Run("well-formed but absent id -> NotFoundError (404, not 500)", func(t *testing.T) {
		status := model.StatusCompleted
		_, err := repo.UpdateTodo(ctx, "00000000-0000-0000-0000-000000000000", nil, nil, &status)
		var nfe model.NotFoundError
		if !errors.As(err, &nfe) {
			t.Fatalf("want NotFoundError, got %v", err)
		}
	})

	t.Run("malformed (non-uuid) id -> NotFoundError, never a 500", func(t *testing.T) {
		status := model.StatusCompleted
		_, err := repo.UpdateTodo(ctx, "not-a-uuid", nil, nil, &status)
		var nfe model.NotFoundError
		if !errors.As(err, &nfe) {
			t.Fatalf("want NotFoundError for a malformed id (22P02), got %v", err)
		}
	})
}
