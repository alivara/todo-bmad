//go:build !testseed

package main

import (
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// registerTestRoutes is a no-op in production builds. The test-only reset endpoint is
// compiled in ONLY under the `testseed` build tag (see testroutes_testseed.go), so it can
// never be reached in the shipped image [TC1].
func registerTestRoutes(_ *gin.Engine, _ *pgxpool.Pool) {}
