// Package handler owns HTTP concerns only (AD-1): routing, request parsing, and
// mapping results/errors to status codes. It never touches SQL and never holds
// business rules — it delegates to the service.
package handler

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/todo-app/api/model"
)

// TodoService is the slice of the service the handlers need. Declaring it here (an
// interface owned by the consumer) keeps the handler decoupled from the concrete
// service type and makes handler tests trivial to stub.
type TodoService interface {
	ListTodos(ctx context.Context) ([]model.Todo, error)
	Health(ctx context.Context) error
}

// NewRouter builds the Gin engine with all api routes registered.
func NewRouter(svc TodoService) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery())

	r.GET("/health", health(svc))
	r.GET("/todos", listTodos(svc))

	return r
}

// health is the readiness probe (AD-12): reports migrated + serving. Migrations have
// already run by the time the router is serving; here we additionally confirm the
// datastore is reachable so the compose healthcheck reflects true readiness.
func health(svc TodoService) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := svc.Health(c.Request.Context()); err != nil {
			slog.Error("health check failed", "error", err)
			// AD-9: every non-2xx uses the uniform error envelope.
			c.JSON(http.StatusServiceUnavailable,
				model.NewAPIError(model.CodeInternalError, "service unavailable"))
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	}
}

// listTodos returns the full list newest-first. The slice is guaranteed non-nil so
// an empty list serializes as [] and never null (AD-6).
func listTodos(svc TodoService) gin.HandlerFunc {
	return func(c *gin.Context) {
		todos, err := svc.ListTodos(c.Request.Context())
		if err != nil {
			slog.Error("list todos failed", "error", err)
			c.JSON(http.StatusInternalServerError,
				model.NewAPIError(model.CodeInternalError, "failed to list todos"))
			return
		}
		if todos == nil {
			todos = []model.Todo{}
		}
		c.JSON(http.StatusOK, todos)
	}
}
