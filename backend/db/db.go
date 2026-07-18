// Package db wires the api to PostgreSQL: it runs the embedded migrations on boot
// (AD-11) and opens the connection pool used by the repository. It is infrastructure
// glue owned by main — the layered handler/service/repository code never imports it.
package db

import (
	"context"
	"errors"
	"fmt"
	"io/fs"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres" // registers the "postgres" database driver
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Migrate applies all pending up migrations embedded in the binary, before the api
// serves (AD-11). It is idempotent: ErrNoChange is treated as success.
func Migrate(databaseURL string, migrationFS fs.FS) error {
	src, err := iofs.New(migrationFS, ".")
	if err != nil {
		return fmt.Errorf("open embedded migrations: %w", err)
	}

	m, err := migrate.NewWithSourceInstance("iofs", src, databaseURL)
	if err != nil {
		return fmt.Errorf("init migrator: %w", err)
	}
	// Best-effort close of the migrator's own resources when done.
	defer func() { _, _ = m.Close() }()

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("apply migrations: %w", err)
	}
	return nil
}

// Connect opens a pgx connection pool and verifies it with a ping.
func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}
	return pool, nil
}
