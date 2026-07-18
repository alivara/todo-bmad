package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/todo-app/api/model"
)

func init() { gin.SetMode(gin.TestMode) }

// stubService implements TodoService so handler behavior can be tested without a DB.
type stubService struct {
	todos     []model.Todo
	listErr   error
	healthErr error
}

func (s stubService) ListTodos(_ context.Context) ([]model.Todo, error) { return s.todos, s.listErr }
func (s stubService) Health(_ context.Context) error                    { return s.healthErr }

func doGET(t *testing.T, svc TodoService, path string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	NewRouter(svc).ServeHTTP(rec, req)
	return rec
}

// AC9 / R3 seed: an empty list must serialize as the bare array [] — never null.
func TestListTodos_EmptyIsBracketsNotNull(t *testing.T) {
	rec := doGET(t, stubService{todos: []model.Todo{}}, "/todos")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if body := rec.Body.String(); body != "[]" {
		t.Fatalf("body = %q, want %q", body, "[]")
	}
}

// Defense in depth: even if the service hands back a nil slice, the handler must
// still emit [] (the classic Go nil-slice-serializes-as-null trap, AD-6).
func TestListTodos_NilSliceStillBrackets(t *testing.T) {
	rec := doGET(t, stubService{todos: nil}, "/todos")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if body := rec.Body.String(); body != "[]" {
		t.Fatalf("body = %q, want %q", body, "[]")
	}
}

// A populated list carries the AD-6 wire shape: camelCase, metadata nesting.
func TestListTodos_WireShape(t *testing.T) {
	svc := stubService{todos: []model.Todo{{
		ID:          "11111111-1111-4111-8111-111111111111",
		Title:       "buy milk",
		Description: "",
		Status:      model.StatusActive,
		Metadata:    model.Metadata{CreatedAt: "2026-07-17T14:03:11Z", UpdatedAt: "2026-07-17T14:03:11Z"},
	}}}

	rec := doGET(t, svc, "/todos")

	var got []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("len = %d, want 1", len(got))
	}
	row := got[0]
	meta, ok := row["metadata"].(map[string]any)
	if !ok {
		t.Fatalf("metadata not nested object, got %T", row["metadata"])
	}
	if _, ok := meta["createdAt"]; !ok {
		t.Fatalf("metadata.createdAt missing (camelCase + nesting expected)")
	}
	if row["description"] != "" {
		t.Fatalf("description = %v, want empty string (never null)", row["description"])
	}
}

// AC7: /health reports 200 when the datastore is reachable.
func TestHealth_OK(t *testing.T) {
	rec := doGET(t, stubService{}, "/health")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["status"] != "ok" {
		t.Fatalf("status = %q, want ok", body["status"])
	}
}

// /health reports 503 when the datastore is unreachable, so compose gating is honest.
func TestHealth_Unavailable(t *testing.T) {
	rec := doGET(t, stubService{healthErr: errors.New("db down")}, "/health")

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
}

// A list error surfaces as the AD-9 error envelope with code internal_error.
func TestListTodos_ErrorEnvelope(t *testing.T) {
	rec := doGET(t, stubService{listErr: errors.New("boom")}, "/todos")

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	var apiErr model.APIError
	if err := json.Unmarshal(rec.Body.Bytes(), &apiErr); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if apiErr.Error.Code != model.CodeInternalError {
		t.Fatalf("code = %q, want %q", apiErr.Error.Code, model.CodeInternalError)
	}
}
