// Command api is the todo REST service: it migrates the schema on boot (AD-11), then
// serves the layered handler/service/repository stack over Gin. It is internal-only —
// only web is exposed to the host (AD-12).
package main

import (
	"context"
	"log/slog"
	"os"

	"github.com/todo-app/api/db"
	"github.com/todo-app/api/handler"
	"github.com/todo-app/api/migrations"
	"github.com/todo-app/api/repository"
	"github.com/todo-app/api/service"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	databaseURL := env("DATABASE_URL", "postgres://todo:todo@db:5432/todo?sslmode=disable")
	port := env("PORT", "8080")

	ctx := context.Background()

	// AD-11: migrations run automatically, BEFORE serving.
	slog.Info("applying migrations")
	if err := db.Migrate(databaseURL, migrations.FS); err != nil {
		slog.Error("migration failed", "error", err)
		os.Exit(1)
	}
	slog.Info("migrations applied")

	pool, err := db.Connect(ctx, databaseURL)
	if err != nil {
		slog.Error("db connect failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	repo := repository.NewPostgres(pool)
	svc := service.New(repo)
	router := handler.NewRouter(svc)

	slog.Info("api serving", "port", port)
	if err := router.Run(":" + port); err != nil {
		slog.Error("server exited", "error", err)
		os.Exit(1)
	}
}

// env returns the value of key, or fallback when unset/empty (12-factor config, AD-12).
func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
