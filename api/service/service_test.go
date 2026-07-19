package service

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/todo-app/api/model"
)

// stubRepo implements repository.Repository so the service's validation logic can be
// tested without a database. It records what CreateTodo received so tests can assert the
// service trimmed the input BEFORE persisting (AD-10).
type stubRepo struct {
	createErr   error
	gotTitle    string
	gotDesc     string
	createCalls int

	// UpdateTodo capture + control.
	updateErr    error
	updateCalls  int
	gotID        string
	gotUpTitle   *string
	gotUpDesc    *string
	gotUpStatus  *string
	updateReturn model.Todo

	// DeleteTodo capture + control.
	deleteErr   error
	deleteCalls int
	gotDeleteID string
}

func (r *stubRepo) ListTodos(context.Context) ([]model.Todo, error) { return nil, nil }
func (r *stubRepo) Ping(context.Context) error                      { return nil }
func (r *stubRepo) CreateTodo(_ context.Context, title, description string) (model.Todo, error) {
	r.createCalls++
	r.gotTitle, r.gotDesc = title, description
	if r.createErr != nil {
		return model.Todo{}, r.createErr
	}
	return model.Todo{ID: "id", Title: title, Description: description, Status: model.StatusActive}, nil
}

func (r *stubRepo) UpdateTodo(_ context.Context, id string, title, description, status *string) (model.Todo, error) {
	r.updateCalls++
	r.gotID, r.gotUpTitle, r.gotUpDesc, r.gotUpStatus = id, title, description, status
	if r.updateErr != nil {
		return model.Todo{}, r.updateErr
	}
	return r.updateReturn, nil
}

func (r *stubRepo) DeleteTodo(_ context.Context, id string) error {
	r.deleteCalls++
	r.gotDeleteID = id
	return r.deleteErr
}

func strptr(s string) *string { return &s }

func isValidationErr(err error) bool {
	var ve model.ValidationError
	return errors.As(err, &ve)
}

// AC3/AC4: an empty or whitespace-only title is rejected as a ValidationError and never
// reaches the repository.
func TestCreateTodo_EmptyOrWhitespaceTitleRejected(t *testing.T) {
	for _, title := range []string{"", "   ", "\t\n "} {
		repo := &stubRepo{}
		svc := New(repo)

		_, err := svc.CreateTodo(context.Background(), title, "")

		if !isValidationErr(err) {
			t.Fatalf("title %q: err = %v, want ValidationError", title, err)
		}
		if repo.createCalls != 0 {
			t.Fatalf("title %q: repository was called %d times, want 0", title, repo.createCalls)
		}
	}
}

// AC4: the title cap is inclusive at 200 code points AND applied AFTER trimming — a value
// padded with whitespace to 202 raw chars but 200 after trim is accepted.
func TestCreateTodo_TitleBoundaryAfterTrim(t *testing.T) {
	repo := &stubRepo{}
	svc := New(repo)

	title := " " + strings.Repeat("a", 200) + " " // 202 raw, 200 after trim
	got, err := svc.CreateTodo(context.Background(), title, "")
	if err != nil {
		t.Fatalf("200-after-trim title: unexpected err %v", err)
	}
	if repo.gotTitle != strings.Repeat("a", 200) {
		t.Fatalf("persisted title not trimmed: len=%d", len(repo.gotTitle))
	}
	if got.Title != strings.Repeat("a", 200) {
		t.Fatalf("returned title mismatch")
	}
}

func TestCreateTodo_TitleOver200Rejected(t *testing.T) {
	repo := &stubRepo{}
	svc := New(repo)

	_, err := svc.CreateTodo(context.Background(), strings.Repeat("a", 201), "")
	if !isValidationErr(err) {
		t.Fatalf("201-char title: err = %v, want ValidationError", err)
	}
	if repo.createCalls != 0 {
		t.Fatalf("repository called on invalid input")
	}
}

// AC4: caps are counted in Unicode code points (runes), NOT grapheme clusters. A ZWJ
// family emoji is 5 code points, so 40 of them (200 code points) is accepted while 41
// (205 code points) is rejected — even though it is only 41 "visible characters". The
// grapheme is built from explicit rune code points to avoid an invisible ZWJ in source.
func TestCreateTodo_CapCountsCodePointsNotGraphemes(t *testing.T) {
	const zwj = 0x200D
	family := string([]rune{0x1F468, zwj, 0x1F469, zwj, 0x1F467}) // 👨‍👩‍👧 = 5 code points
	svc := New(&stubRepo{})

	if _, err := svc.CreateTodo(context.Background(), strings.Repeat(family, 40), ""); err != nil {
		t.Fatalf("200 code points (40 graphemes): unexpected err %v", err)
	}
	if _, err := svc.CreateTodo(context.Background(), strings.Repeat(family, 41), ""); !isValidationErr(err) {
		t.Fatalf("205 code points (41 graphemes): err = %v, want ValidationError", err)
	}
}

// AC4: description is optional, capped at 2000 code points after trim, and trimmed before
// persistence.
func TestCreateTodo_DescriptionCapAndTrim(t *testing.T) {
	repo := &stubRepo{}
	svc := New(repo)

	if _, err := svc.CreateTodo(context.Background(), "ok", strings.Repeat("d", 2000)); err != nil {
		t.Fatalf("2000-char description: unexpected err %v", err)
	}
	if _, err := svc.CreateTodo(context.Background(), "ok", strings.Repeat("d", 2001)); !isValidationErr(err) {
		t.Fatalf("2001-char description: want ValidationError, got %v", err)
	}

	repo2 := &stubRepo{}
	if _, err := New(repo2).CreateTodo(context.Background(), "ok", "  note  "); err != nil {
		t.Fatalf("unexpected err %v", err)
	}
	if repo2.gotDesc != "note" {
		t.Fatalf("persisted description = %q, want trimmed \"note\"", repo2.gotDesc)
	}
}

// A repository failure propagates unchanged (not masked as a ValidationError) so the
// handler maps it to 500, not 400.
func TestCreateTodo_RepositoryErrorPropagates(t *testing.T) {
	repo := &stubRepo{createErr: errors.New("db down")}
	_, err := New(repo).CreateTodo(context.Background(), "hi", "")
	if err == nil || isValidationErr(err) {
		t.Fatalf("err = %v, want a non-validation error", err)
	}
}

func isNotFoundErr(err error) bool {
	var nfe model.NotFoundError
	return errors.As(err, &nfe)
}

// 2.1 AC / AD-8: a status outside {active,completed} is rejected as a ValidationError and
// NEVER reaches the repository (the service is the second sync point besides the DB CHECK).
func TestUpdateTodo_InvalidStatusRejectedNeverReachesRepo(t *testing.T) {
	for _, status := range []string{"archived", "ACTIVE", "", "done"} {
		repo := &stubRepo{}
		svc := New(repo)

		_, err := svc.UpdateTodo(context.Background(), "id", nil, nil, strptr(status))

		if !isValidationErr(err) {
			t.Fatalf("status %q: err = %v, want ValidationError", status, err)
		}
		if repo.updateCalls != 0 {
			t.Fatalf("status %q: repository called %d times, want 0", status, repo.updateCalls)
		}
	}
}

// 2.1 AC / AD-8: both allow-list values pass validation and reach the repo as the provided
// status pointer, with title/description left nil (unchanged) for a status-only toggle.
func TestUpdateTodo_AllowedStatusesReachRepo(t *testing.T) {
	for _, status := range []string{model.StatusActive, model.StatusCompleted} {
		repo := &stubRepo{updateReturn: model.Todo{ID: "id", Status: status}}
		svc := New(repo)

		got, err := svc.UpdateTodo(context.Background(), "id", nil, nil, strptr(status))
		if err != nil {
			t.Fatalf("status %q: unexpected err %v", status, err)
		}
		if repo.updateCalls != 1 {
			t.Fatalf("status %q: repository called %d times, want 1", status, repo.updateCalls)
		}
		if repo.gotUpStatus == nil || *repo.gotUpStatus != status {
			t.Fatalf("status %q: repo got %v, want the provided status pointer", status, repo.gotUpStatus)
		}
		if repo.gotUpTitle != nil || repo.gotUpDesc != nil {
			t.Fatalf("status %q: title/description must forward as nil (unchanged)", status)
		}
		if got.Status != status {
			t.Fatalf("status %q: returned status = %q", status, got.Status)
		}
	}
}

// 2.1 AC: a repository NotFoundError (pgx.ErrNoRows for an unknown id) propagates unchanged
// so the handler maps it to 404 — not masked as a ValidationError or a generic 500.
func TestUpdateTodo_NotFoundPropagates(t *testing.T) {
	repo := &stubRepo{updateErr: model.NotFoundError{Message: "todo not found"}}
	_, err := New(repo).UpdateTodo(context.Background(), "missing", nil, nil, strptr(model.StatusCompleted))
	if !isNotFoundErr(err) {
		t.Fatalf("err = %v, want NotFoundError", err)
	}
	if isValidationErr(err) {
		t.Fatalf("NotFoundError must not be a ValidationError")
	}
}

// 2.1 (contract-only path): a provided title is validated + trimmed via the SAME helper as
// CreateTodo before reaching the repo; an over-cap title is rejected pre-repo. A whitespace
// title is invalid (an edit may not blank the title, matching Create's required rule).
func TestUpdateTodo_TitleValidatedAndTrimmed(t *testing.T) {
	repo := &stubRepo{updateReturn: model.Todo{ID: "id"}}
	if _, err := New(repo).UpdateTodo(context.Background(), "id", strptr("  hello  "), nil, nil); err != nil {
		t.Fatalf("unexpected err %v", err)
	}
	if repo.gotUpTitle == nil || *repo.gotUpTitle != "hello" {
		t.Fatalf("repo title = %v, want trimmed \"hello\"", repo.gotUpTitle)
	}

	repo2 := &stubRepo{}
	if _, err := New(repo2).UpdateTodo(context.Background(), "id", strptr(strings.Repeat("a", 201)), nil, nil); !isValidationErr(err) {
		t.Fatalf("201-char title: err = %v, want ValidationError", err)
	}
	if repo2.updateCalls != 0 {
		t.Fatalf("repository called on invalid title")
	}
}

// 2.2 AC (the crux): a description CLEAR — a non-nil *string("") — forwards to the repository as
// a non-nil empty pointer with NO validation error. "" is a valid description (optional, blank
// allowed), and it must stay PRESENT (not be dropped to nil) so the repository writes the clear,
// distinct from an omitted/unchanged description (AD-6).
func TestUpdateTodo_DescriptionClearForwardsNonNilEmpty(t *testing.T) {
	repo := &stubRepo{updateReturn: model.Todo{ID: "id", Description: ""}}
	if _, err := New(repo).UpdateTodo(context.Background(), "id", nil, strptr(""), nil); err != nil {
		t.Fatalf("description clear: unexpected err %v", err)
	}
	if repo.updateCalls != 1 {
		t.Fatalf("repository called %d times, want 1", repo.updateCalls)
	}
	if repo.gotUpDesc == nil {
		t.Fatalf("repo description = nil, want a non-nil *string(\"\") — the clear must reach the repo")
	}
	if *repo.gotUpDesc != "" {
		t.Fatalf("repo description = %q, want empty string", *repo.gotUpDesc)
	}
	// Only description was in the patch; title/status stay nil (unchanged).
	if repo.gotUpTitle != nil || repo.gotUpStatus != nil {
		t.Fatalf("title/status must forward as nil (unchanged) for a description-only clear")
	}
}

// 2.2 AC: a provided description over the 2000 code-point cap is rejected as a ValidationError
// pre-repo (the SAME trim+rune-cap helper CreateTodo uses); the repository is never called.
func TestUpdateTodo_DescriptionOverCapRejected(t *testing.T) {
	repo := &stubRepo{}
	if _, err := New(repo).UpdateTodo(context.Background(), "id", nil, strptr(strings.Repeat("d", 2001)), nil); !isValidationErr(err) {
		t.Fatalf("2001-char description: err = %v, want ValidationError", err)
	}
	if repo.updateCalls != 0 {
		t.Fatalf("repository called on invalid description")
	}

	// The boundary passes: exactly 2000 code points after trim is accepted and forwarded.
	repoOk := &stubRepo{updateReturn: model.Todo{ID: "id"}}
	if _, err := New(repoOk).UpdateTodo(context.Background(), "id", nil, strptr(strings.Repeat("d", 2000)), nil); err != nil {
		t.Fatalf("2000-char description: unexpected err %v", err)
	}
	if repoOk.gotUpDesc == nil || *repoOk.gotUpDesc != strings.Repeat("d", 2000) {
		t.Fatalf("repo description not forwarded at the 2000 boundary")
	}
}

// 2.2 AC: an edit that blanks the title (empty or whitespace-only) is rejected as a
// ValidationError pre-repo — an edit may not clear the title (matching Create's required rule);
// the repository is never called.
func TestUpdateTodo_EmptyOrWhitespaceTitleRejected(t *testing.T) {
	for _, title := range []string{"", "   ", "\t\n "} {
		repo := &stubRepo{}
		_, err := New(repo).UpdateTodo(context.Background(), "id", strptr(title), nil, nil)

		if !isValidationErr(err) {
			t.Fatalf("title %q: err = %v, want ValidationError", title, err)
		}
		if repo.updateCalls != 0 {
			t.Fatalf("title %q: repository called %d times, want 0", title, repo.updateCalls)
		}
	}
}

// 2.3 AC: DeleteTodo is a thin passthrough — it forwards the id to the repository with no
// business rule applied (the pending/undo lifecycle is entirely client-side, AD-5) and returns
// nil on success.
func TestDeleteTodo_ForwardsToRepo(t *testing.T) {
	repo := &stubRepo{}
	if err := New(repo).DeleteTodo(context.Background(), "the-id"); err != nil {
		t.Fatalf("unexpected err %v", err)
	}
	if repo.deleteCalls != 1 {
		t.Fatalf("repository called %d times, want 1", repo.deleteCalls)
	}
	if repo.gotDeleteID != "the-id" {
		t.Fatalf("repo got id %q, want the forwarded id", repo.gotDeleteID)
	}
}

// 2.3 AC: a repository NotFoundError (unknown/malformed id → RowsAffected==0 or 22P02)
// propagates unchanged so the handler maps it to 404 — never masked as a 500.
func TestDeleteTodo_NotFoundPropagates(t *testing.T) {
	repo := &stubRepo{deleteErr: model.NotFoundError{Message: "todo not found"}}
	err := New(repo).DeleteTodo(context.Background(), "missing")
	if !isNotFoundErr(err) {
		t.Fatalf("err = %v, want NotFoundError", err)
	}
}

// 2.1: an empty patch (all fields nil) is a valid no-op — it passes straight through to the
// repository (which returns the current row) with no validation error.
func TestUpdateTodo_EmptyPatchPassesThrough(t *testing.T) {
	repo := &stubRepo{updateReturn: model.Todo{ID: "id", Status: model.StatusActive}}
	if _, err := New(repo).UpdateTodo(context.Background(), "id", nil, nil, nil); err != nil {
		t.Fatalf("empty patch: unexpected err %v", err)
	}
	if repo.updateCalls != 1 {
		t.Fatalf("repository called %d times, want 1 (no-op passes through)", repo.updateCalls)
	}
}
