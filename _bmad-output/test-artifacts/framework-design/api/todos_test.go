package api_test

// Go test + testify samples for the `api` service.
// Covers server-authoritative validation, the AD-6 contract, and injection safety [R4].
// Run against the compose test profile: `go test ./...`.
//
// These are integration-flavored (handler -> service -> repository -> Postgres);
// pure-logic cases (rune counting, status transitions) belong in service-package unit tests.

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// c is a thin test client over the running api (see testhelpers). Sketch only.
func TestCreateTodo_ValidReturnsAD6Shape(t *testing.T) {
	c := newTestClient(t)
	t.Cleanup(c.resetTodos) // TC1: self-cleaning

	status, todo := c.post("/todos", map[string]any{"title": "Email Sam the Q3 numbers"})

	require.Equal(t, http.StatusCreated, status)
	assert.Regexp(t, uuidV4, todo["id"])
	assert.Equal(t, "active", todo["status"])          // server default
	assert.Equal(t, "", todo["description"])           // "" never null
	meta := todo["metadata"].(map[string]any)          // timestamps nested (AD-6)
	assert.Regexp(t, rfc3339Z, meta["createdAt"])
	assert.NotContains(t, todo, "created_at")           // snake_case must not leak
}

func TestCreateTodo_EmptyTitleRejected(t *testing.T) {
	c := newTestClient(t)
	t.Cleanup(c.resetTodos)

	status, body := c.post("/todos", map[string]any{"title": "   "}) // whitespace-only

	require.Equal(t, http.StatusBadRequest, status)
	errObj := body["error"].(map[string]any)
	assert.Equal(t, "validation_error", errObj["code"]) // AD-9
}

// R4: server-side sanitization is the only safety net (no auth). SQL must be parameterized.
func TestCreateTodo_InjectionIsInert(t *testing.T) {
	c := newTestClient(t)
	t.Cleanup(c.resetTodos)

	payload := "'; DROP TABLE todos; --"
	status, _ := c.post("/todos", map[string]any{"title": payload})
	require.Contains(t, []int{http.StatusCreated, http.StatusBadRequest}, status)

	// The table must still exist and behave: a follow-up list still works.
	listStatus, list := c.getList("/todos")
	require.Equal(t, http.StatusOK, listStatus)
	assert.NotNil(t, list) // [] never nil (AD-6)
}

func TestHealth_ReadyAfterMigrate(t *testing.T) { // TC5
	c := newTestClient(t)
	status, _ := c.getList("/health")
	assert.Equal(t, http.StatusOK, status)
}
