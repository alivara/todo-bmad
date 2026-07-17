package testhelpers

// Test-only seed/reset seam [TC1]. Test profile ONLY — never wired into a prod build.
// Gives integration/E2E a fast way to set list states and reset for parallel isolation.
//
// Guard it behind a build tag or an APP_ENV check so it can never run in production:
//   //go:build testseed
//
// Sketch — adapt to the real repository interface (AD-2) once it exists.

import (
	"context"
	"database/sql"
)

// ResetTodos truncates the todos table between tests. Parameterized/DDL only, never user input.
func ResetTodos(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, "TRUNCATE TABLE todos RESTART IDENTITY CASCADE")
	return err
}

// SeedTodo inserts one row directly for a known starting state. Parameterized SQL (R4 discipline).
func SeedTodo(ctx context.Context, db *sql.DB, title, description, status string) (string, error) {
	var id string
	err := db.QueryRowContext(
		ctx,
		`INSERT INTO todos (title, description, status) VALUES ($1, $2, $3) RETURNING id`,
		title, description, status,
	).Scan(&id)
	return id, err
}
