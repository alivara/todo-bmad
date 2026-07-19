// Package handler owns HTTP concerns only (AD-1): routing, request parsing, and
// mapping results/errors to status codes. It never touches SQL and never holds
// business rules — it delegates to the service.
package handler

import (
	"context"
	"errors"
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
	CreateTodo(ctx context.Context, title, description string) (model.Todo, error)
	UpdateTodo(ctx context.Context, id string, title, description, status *string) (model.Todo, error)
	DeleteTodo(ctx context.Context, id string) error
	Health(ctx context.Context) error
}

// createTodoRequest mirrors shared/todo.ts CreateTodoRequest. Binding into a struct with
// ONLY title + description means any client-supplied id/status/metadata is ignored (AD-6);
// an absent description decodes to "" (Go zero value), never null.
type createTodoRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

// updateTodoRequest mirrors shared/todo.ts UpdateTodoRequest. Fields are POINTERS so an
// absent field decodes to nil = unchanged (AD-6), never a zero-value overwrite. Any
// combination is atomic in one call.
type updateTodoRequest struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
}

// NewRouter builds the Gin engine with all api routes registered.
func NewRouter(svc TodoService) *gin.Engine {
	r := gin.New()
	// Custom recovery so a panic (nil deref, driver panic, …) is caught AND returned as the AD-9
	// envelope — Gin's default Recovery aborts with a bare, bodyless 500 that escapes the uniform
	// error contract (AC1: EVERY non-2xx is enveloped). The process stays up; the panic is logged.
	r.Use(gin.CustomRecovery(func(c *gin.Context, err any) {
		slog.Error("panic recovered", "error", err, "path", c.Request.URL.Path)
		c.AbortWithStatusJSON(http.StatusInternalServerError,
			model.NewAPIError(model.CodeInternalError, "internal error"))
	}))

	r.GET("/health", health(svc))
	r.GET("/todos", listTodos(svc))
	r.POST("/todos", createTodo(svc))
	r.PATCH("/todos/:id", updateTodo(svc))
	r.DELETE("/todos/:id", deleteTodo(svc))

	// AC1 gap: an unmatched path would otherwise return Gin's plaintext 404, escaping the AD-9
	// envelope. NoRoute keeps every non-2xx inside the uniform { error: { code, message } } shape.
	// With HandleMethodNotAllowed off (the default), a wrong method on an existing path also falls
	// through here, so this one handler covers unmatched-path AND wrong-method (405 is out of scope
	// — the vocab has no 405 code).
	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, model.NewAPIError(model.CodeNotFound, "route not found"))
	})

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
		// The serializer maps the domain slice to the AD-6 wire shape and always
		// returns a non-nil slice, so an empty list is [] and never null.
		c.JSON(http.StatusOK, toTodoResponses(todos))
	}
}

// createTodo handles POST /todos: bind the body, delegate to the service (which owns
// validation, AD-1/AD-10), and map the result to a status code. A validation failure is
// the AD-9 400 validation_error envelope; success is 201 + the full AD-6 resource (the
// client needs it for the AD-7 temp-id swap).
func createTodo(svc TodoService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req createTodoRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			// A malformed/absent JSON body is a client error, not a server fault.
			c.JSON(http.StatusBadRequest,
				model.NewAPIError(model.CodeValidationError, "invalid request body"))
			return
		}

		created, err := svc.CreateTodo(c.Request.Context(), req.Title, req.Description)
		if err != nil {
			// A ValidationError maps to 400; anything else is an unexpected 500. errors.As
			// lets the handler recognize the service's error without importing the service
			// package (the type lives in model).
			var ve model.ValidationError
			if errors.As(err, &ve) {
				c.JSON(http.StatusBadRequest,
					model.NewAPIError(model.CodeValidationError, ve.Error()))
				return
			}
			slog.Error("create todo failed", "error", err)
			c.JSON(http.StatusInternalServerError,
				model.NewAPIError(model.CodeInternalError, "failed to create todo"))
			return
		}

		c.JSON(http.StatusCreated, toTodoResponse(created))
	}
}

// updateTodo handles PATCH /todos/:id (AD-6 partial update): bind the pointer body (absent =
// unchanged), read the id from the path, delegate to the service (which owns validation and
// the AD-8 status allow-list), and map the result. A ValidationError → 400 validation_error;
// a NotFoundError (unknown id) → 404 not_found; anything else → 500 internal_error; success →
// 200 + the full AD-6 resource (reusing toTodoResponse) with the server-bumped updatedAt.
func updateTodo(svc TodoService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req updateTodoRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest,
				model.NewAPIError(model.CodeValidationError, "invalid request body"))
			return
		}

		updated, err := svc.UpdateTodo(c.Request.Context(), c.Param("id"), req.Title, req.Description, req.Status)
		if err != nil {
			var ve model.ValidationError
			if errors.As(err, &ve) {
				c.JSON(http.StatusBadRequest,
					model.NewAPIError(model.CodeValidationError, ve.Error()))
				return
			}
			var nfe model.NotFoundError
			if errors.As(err, &nfe) {
				c.JSON(http.StatusNotFound,
					model.NewAPIError(model.CodeNotFound, nfe.Error()))
				return
			}
			slog.Error("update todo failed", "error", err)
			c.JSON(http.StatusInternalServerError,
				model.NewAPIError(model.CodeInternalError, "failed to update todo"))
			return
		}

		c.JSON(http.StatusOK, toTodoResponse(updated))
	}
}

// deleteTodo handles DELETE /todos/:id. The server does a plain hard delete (AD-5 — the
// pending/undo window lives entirely on the client, so by the time this fires the client has
// already committed to the delete). Read the id from the path, delegate to the service, and map
// the result: success → 204 empty (no body); a NotFoundError (unknown/already-gone id) → 404
// not_found (which the client treats as success, RD-5); anything else → 500 internal_error.
func deleteTodo(svc TodoService) gin.HandlerFunc {
	return func(c *gin.Context) {
		err := svc.DeleteTodo(c.Request.Context(), c.Param("id"))
		if err != nil {
			var nfe model.NotFoundError
			if errors.As(err, &nfe) {
				c.JSON(http.StatusNotFound,
					model.NewAPIError(model.CodeNotFound, nfe.Error()))
				return
			}
			slog.Error("delete todo failed", "error", err)
			c.JSON(http.StatusInternalServerError,
				model.NewAPIError(model.CodeInternalError, "failed to delete todo"))
			return
		}

		c.Status(http.StatusNoContent)
	}
}
