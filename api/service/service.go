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
	title = strings.TrimSpace(title)
	description = strings.TrimSpace(description)

	if title == "" {
		return model.Todo{}, model.ValidationError{Message: "title is required"}
	}
	if utf8.RuneCountInString(title) > MaxTitleLen {
		return model.Todo{}, model.ValidationError{
			Message: fmt.Sprintf("title must be at most %d characters", MaxTitleLen),
		}
	}
	if utf8.RuneCountInString(description) > MaxDescriptionLen {
		return model.Todo{}, model.ValidationError{
			Message: fmt.Sprintf("description must be at most %d characters", MaxDescriptionLen),
		}
	}

	return s.repo.CreateTodo(ctx, title, description)
}

// Health reports whether the datastore is reachable (readiness for GET /health).
func (s *Service) Health(ctx context.Context) error {
	return s.repo.Ping(ctx)
}
