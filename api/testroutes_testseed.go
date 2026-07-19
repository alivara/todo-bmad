//go:build testseed

package main

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/todo-app/api/model"
	"github.com/todo-app/api/testhelpers"
)

// registerTestRoutes wires a test-only reset endpoint, compiled ONLY under the `testseed`
// build tag (never in the production image). It lets Playwright/integration suites reset
// list state deterministically between runs WITHOUT a real DELETE endpoint (which is
// Story 2.3, Epic 2). It reuses the same parameterized testhelpers seam as the Go tests,
// so it is never reachable in a prod build [TC1].
func registerTestRoutes(r *gin.Engine, pool *pgxpool.Pool) {
	r.POST("/internal/test/reset", func(c *gin.Context) {
		if err := testhelpers.ResetTodos(c.Request.Context(), pool); err != nil {
			c.JSON(http.StatusInternalServerError,
				model.NewAPIError(model.CodeInternalError, "reset failed"))
			return
		}
		c.Status(http.StatusNoContent)
	})
}
