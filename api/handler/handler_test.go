package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/todo-app/api/model"
)

func init() { gin.SetMode(gin.TestMode) }

// stubService implements TodoService so handler behavior can be tested without a DB.
type stubService struct {
	todos     []model.Todo
	listErr   error
	healthErr error
	// created is returned from CreateTodo on success; createErr forces a failure path.
	created   model.Todo
	createErr error
	// lastCreate captures the arguments the handler forwarded (to assert binding).
	lastCreate *createArgs
	// updated is returned from UpdateTodo on success; updateErr forces a failure path.
	updated   model.Todo
	updateErr error
	// lastUpdate captures the arguments the handler forwarded (to assert pointer binding).
	lastUpdate *updateArgs
}

type createArgs struct{ title, description string }

type updateArgs struct {
	id                       string
	title, description, stat *string
}

func (s stubService) ListTodos(_ context.Context) ([]model.Todo, error) { return s.todos, s.listErr }
func (s stubService) Health(_ context.Context) error                    { return s.healthErr }

func (s *stubService) CreateTodo(_ context.Context, title, description string) (model.Todo, error) {
	s.lastCreate = &createArgs{title: title, description: description}
	if s.createErr != nil {
		return model.Todo{}, s.createErr
	}
	return s.created, nil
}

func (s *stubService) UpdateTodo(_ context.Context, id string, title, description, status *string) (model.Todo, error) {
	s.lastUpdate = &updateArgs{id: id, title: title, description: description, stat: status}
	if s.updateErr != nil {
		return model.Todo{}, s.updateErr
	}
	return s.updated, nil
}

func doGET(t *testing.T, svc TodoService, path string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	NewRouter(svc).ServeHTTP(rec, req)
	return rec
}

func doPOST(t *testing.T, svc TodoService, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	NewRouter(svc).ServeHTTP(rec, req)
	return rec
}

func doPATCH(t *testing.T, svc TodoService, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	NewRouter(svc).ServeHTTP(rec, req)
	return rec
}

// AC9 / R3 seed: an empty list must serialize as the bare array [] — never null.
func TestListTodos_EmptyIsBracketsNotNull(t *testing.T) {
	rec := doGET(t, &stubService{todos: []model.Todo{}}, "/todos")

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
	rec := doGET(t, &stubService{todos: nil}, "/todos")

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if body := rec.Body.String(); body != "[]" {
		t.Fatalf("body = %q, want %q", body, "[]")
	}
}

// A populated list carries the AD-6 wire shape: camelCase, metadata nesting, and the
// serializer's RFC3339-Z formatting of the domain's native time.Time.
func TestListTodos_WireShape(t *testing.T) {
	ts := time.Date(2026, 7, 17, 14, 3, 11, 0, time.UTC)
	svc := &stubService{todos: []model.Todo{{
		ID:          "11111111-1111-4111-8111-111111111111",
		Title:       "buy milk",
		Description: "",
		Status:      model.StatusActive,
		CreatedAt:   ts,
		UpdatedAt:   ts,
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
	if meta["createdAt"] != "2026-07-17T14:03:11Z" {
		t.Fatalf("metadata.createdAt = %v, want RFC3339-Z serialized timestamp", meta["createdAt"])
	}
	if row["description"] != "" {
		t.Fatalf("description = %v, want empty string (never null)", row["description"])
	}
}

// AC7: /health reports 200 when the datastore is reachable.
func TestHealth_OK(t *testing.T) {
	rec := doGET(t, &stubService{}, "/health")

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
	rec := doGET(t, &stubService{healthErr: errors.New("db down")}, "/health")

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
}

// A list error surfaces as the AD-9 error envelope with code internal_error.
func TestListTodos_ErrorEnvelope(t *testing.T) {
	rec := doGET(t, &stubService{listErr: errors.New("boom")}, "/todos")

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

// AC2: a valid POST returns 201 + the full AD-6 resource the service handed back
// (camelCase, metadata nesting, server-set status/timestamps).
func TestCreateTodo_ValidReturns201AD6Shape(t *testing.T) {
	ts := time.Date(2026, 7, 17, 14, 3, 11, 0, time.UTC)
	svc := &stubService{created: model.Todo{
		ID:          "22222222-2222-4222-8222-222222222222",
		Title:       "Email Sam the Q3 numbers",
		Description: "",
		Status:      model.StatusActive,
		CreatedAt:   ts,
		UpdatedAt:   ts,
	}}

	rec := doPOST(t, svc, "/todos", `{"title":"Email Sam the Q3 numbers"}`)

	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201", rec.Code)
	}
	var row map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &row); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if row["id"] != "22222222-2222-4222-8222-222222222222" {
		t.Fatalf("id = %v, want server-assigned uuid", row["id"])
	}
	if row["status"] != model.StatusActive {
		t.Fatalf("status = %v, want active", row["status"])
	}
	if row["description"] != "" {
		t.Fatalf("description = %v, want empty string (never null)", row["description"])
	}
	meta, ok := row["metadata"].(map[string]any)
	if !ok || meta["createdAt"] != "2026-07-17T14:03:11Z" {
		t.Fatalf("metadata.createdAt = %v, want nested RFC3339-Z timestamp", row["metadata"])
	}
	if _, leaked := row["created_at"]; leaked {
		t.Fatalf("snake_case created_at leaked to the wire")
	}
}

// AC4: the handler binds only title + description; a client-supplied id/status/metadata
// is ignored (never forwarded to the service).
func TestCreateTodo_IgnoresClientControlledFields(t *testing.T) {
	svc := &stubService{created: model.Todo{ID: "x", Title: "hi", Status: model.StatusActive}}

	body := `{"title":"hi","description":"note","id":"client-id","status":"completed","metadata":{"createdAt":"1999-01-01T00:00:00Z"}}`
	doPOST(t, svc, "/todos", body)

	if svc.lastCreate == nil {
		t.Fatalf("service was not called")
	}
	if svc.lastCreate.title != "hi" || svc.lastCreate.description != "note" {
		t.Fatalf("forwarded (%q,%q), want (\"hi\",\"note\") — only title+description",
			svc.lastCreate.title, svc.lastCreate.description)
	}
}

// AC4: a service ValidationError maps to 400 validation_error (AD-9).
func TestCreateTodo_ValidationErrorIs400(t *testing.T) {
	svc := &stubService{createErr: model.ValidationError{Message: "title is required"}}

	rec := doPOST(t, svc, "/todos", `{"title":"   "}`)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	var apiErr model.APIError
	if err := json.Unmarshal(rec.Body.Bytes(), &apiErr); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if apiErr.Error.Code != model.CodeValidationError {
		t.Fatalf("code = %q, want %q", apiErr.Error.Code, model.CodeValidationError)
	}
}

// A malformed JSON body is a 400 validation_error, never a 500 or an HTML panic.
func TestCreateTodo_MalformedBodyIs400(t *testing.T) {
	rec := doPOST(t, &stubService{}, "/todos", `{"title":`)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

// 2.1 AC: a valid status PATCH returns 200 + the full AD-6 resource the service handed back
// (status updated, updatedAt bumped, camelCase + metadata nesting). The handler must decode
// the body as pointers and forward only the provided field (status) — title/description nil.
func TestUpdateTodo_ValidStatusReturns200AD6Shape(t *testing.T) {
	ts := time.Date(2026, 7, 17, 14, 3, 11, 0, time.UTC)
	bumped := time.Date(2026, 7, 17, 15, 0, 0, 0, time.UTC)
	svc := &stubService{updated: model.Todo{
		ID:          "33333333-3333-4333-8333-333333333333",
		Title:       "Email Sam the Q3 numbers",
		Description: "",
		Status:      model.StatusCompleted,
		CreatedAt:   ts,
		UpdatedAt:   bumped,
	}}

	rec := doPATCH(t, svc, "/todos/33333333-3333-4333-8333-333333333333", `{"status":"completed"}`)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	// Only status was in the body → title/description forwarded as nil (unchanged), status set.
	if svc.lastUpdate == nil {
		t.Fatalf("service was not called")
	}
	if svc.lastUpdate.id != "33333333-3333-4333-8333-333333333333" {
		t.Fatalf("id = %q, want the path param", svc.lastUpdate.id)
	}
	if svc.lastUpdate.title != nil || svc.lastUpdate.description != nil {
		t.Fatalf("absent fields must forward as nil (unchanged), got title=%v desc=%v",
			svc.lastUpdate.title, svc.lastUpdate.description)
	}
	if svc.lastUpdate.stat == nil || *svc.lastUpdate.stat != model.StatusCompleted {
		t.Fatalf("status = %v, want pointer to completed", svc.lastUpdate.stat)
	}

	var row map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &row); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if row["status"] != model.StatusCompleted {
		t.Fatalf("status = %v, want completed", row["status"])
	}
	meta, ok := row["metadata"].(map[string]any)
	if !ok || meta["updatedAt"] != "2026-07-17T15:00:00Z" {
		t.Fatalf("metadata.updatedAt = %v, want the bumped RFC3339-Z timestamp", row["metadata"])
	}
}

// 2.1 AC: an invalid status is rejected by the service as a ValidationError → 400 (AD-9). The
// handler must never emit a 500 for a business-rule rejection.
func TestUpdateTodo_InvalidStatusIs400(t *testing.T) {
	svc := &stubService{updateErr: model.ValidationError{Message: "status must be one of active or completed"}}

	rec := doPATCH(t, svc, "/todos/abc", `{"status":"archived"}`)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	var apiErr model.APIError
	if err := json.Unmarshal(rec.Body.Bytes(), &apiErr); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if apiErr.Error.Code != model.CodeValidationError {
		t.Fatalf("code = %q, want %q", apiErr.Error.Code, model.CodeValidationError)
	}
}

// 2.1 AC: an unknown id surfaces from the service as a NotFoundError → 404 not_found (AD-9),
// the first producer of CodeNotFound.
func TestUpdateTodo_UnknownIdIs404(t *testing.T) {
	svc := &stubService{updateErr: model.NotFoundError{Message: "todo not found"}}

	rec := doPATCH(t, svc, "/todos/does-not-exist", `{"status":"completed"}`)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
	var apiErr model.APIError
	if err := json.Unmarshal(rec.Body.Bytes(), &apiErr); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if apiErr.Error.Code != model.CodeNotFound {
		t.Fatalf("code = %q, want %q", apiErr.Error.Code, model.CodeNotFound)
	}
}

// An unexpected (non-validation) error maps to the AD-9 500 internal_error envelope.
func TestCreateTodo_UnexpectedErrorIs500(t *testing.T) {
	rec := doPOST(t, &stubService{createErr: errors.New("db down")}, "/todos", `{"title":"hi"}`)

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
