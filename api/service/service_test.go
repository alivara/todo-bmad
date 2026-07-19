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
