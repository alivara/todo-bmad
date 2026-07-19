// Package service holds the business rules (AD-1). It depends only on the repository
// interface — never on Gin or HTTP concerns. In Story 1.1 the surface is small
// (list + health); validation and status-transition rules land in later stories.
package service

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/todo-app/api/model"
	"github.com/todo-app/api/repository"
)

// Validation caps (AD-10). Counted in Unicode code points (runes) AFTER trimming
// whitespace, so the client mirror ([...s.trim()].length) stays exact.
const (
	MaxTitleLen       = 200
	MaxDescriptionLen = 2000
)

// Service is the business-logic entry point for todos.
type Service struct {
	repo repository.Repository
}

// New constructs a Service over any Repository implementation (real or test stub).
func New(repo repository.Repository) *Service {
	return &Service{repo: repo}
}

// ListTodos returns all todos, newest-first, as a non-nil slice.
func (s *Service) ListTodos(ctx context.Context) ([]model.Todo, error) {
	return s.repo.ListTodos(ctx)
}

// CreateTodo validates and persists a new todo (AD-10, server-authoritative). Both fields
// are trimmed FIRST, then the caps are applied: title is required and ≤200 code points;
// description is optional and ≤2000. The trimmed values are what get persisted, so the
// optimistically rendered client text equals the stored text. The server assigns
// id/status/timestamps (AD-7) — a client-supplied status is never accepted here.
func (s *Service) CreateTodo(ctx context.Context, title, description string) (model.Todo, error) {
	title, err := validateTitle(title)
	if err != nil {
		return model.Todo{}, err
	}
	description, err = validateDescription(description)
	if err != nil {
		return model.Todo{}, err
	}

	return s.repo.CreateTodo(ctx, title, description)
}

// UpdateTodo validates and applies a partial update (AD-6, AD-10). Each provided (non-nil)
// field is validated independently — status against the AD-8 allow-list ({active,completed},
// the second sync point besides the DB CHECK), title/description via the SAME trim+rune-cap
// helpers CreateTodo uses (no duplication). An invalid field returns a ValidationError and
// never reaches the repository. The trimmed value replaces the caller's pointer so the
// persisted text equals the optimistically rendered text. A missing id surfaces from the
// repository as model.NotFoundError, propagated unchanged.
func (s *Service) UpdateTodo(ctx context.Context, id string, title, description, status *string) (model.Todo, error) {
	if title != nil {
		validated, err := validateTitle(*title)
		if err != nil {
			return model.Todo{}, err
		}
		title = &validated
	}
	if description != nil {
		validated, err := validateDescription(*description)
		if err != nil {
			return model.Todo{}, err
		}
		description = &validated
	}
	if status != nil {
		if *status != model.StatusActive && *status != model.StatusCompleted {
			return model.Todo{}, model.ValidationError{
				Message: fmt.Sprintf("status must be one of %q or %q", model.StatusActive, model.StatusCompleted),
			}
		}
	}

	return s.repo.UpdateTodo(ctx, id, title, description, status)
}

// DeleteTodo hard-deletes a todo by id (AD-5). There is no business rule to apply — the
// pending/undo lifecycle lives entirely on the client and the server just does the delete — so
// this is a thin passthrough. A missing id surfaces from the repository as model.NotFoundError,
// propagated unchanged for the handler to map to 404.
func (s *Service) DeleteTodo(ctx context.Context, id string) error {
	return s.repo.DeleteTodo(ctx, id)
}

// validateTitle trims then applies the required + ≤200-code-point rule (AD-10). The trimmed
// value is returned so callers persist exactly what was validated. Shared by Create + Update.
func validateTitle(title string) (string, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return "", model.ValidationError{Message: "title is required"}
	}
	if utf8.RuneCountInString(title) > MaxTitleLen {
		return "", model.ValidationError{
			Message: fmt.Sprintf("title must be at most %d characters", MaxTitleLen),
		}
	}
	return title, nil
}

// validateDescription trims then applies the optional ≤2000-code-point rule (AD-10). Blank is
// valid ("" persisted, never null). The trimmed value is returned. Shared by Create + Update.
func validateDescription(description string) (string, error) {
	description = strings.TrimSpace(description)
	if utf8.RuneCountInString(description) > MaxDescriptionLen {
		return "", model.ValidationError{
			Message: fmt.Sprintf("description must be at most %d characters", MaxDescriptionLen),
		}
	}
	return description, nil
}

// Health reports whether the datastore is reachable (readiness for GET /health).
func (s *Service) Health(ctx context.Context) error {
	return s.repo.Ping(ctx)
}
