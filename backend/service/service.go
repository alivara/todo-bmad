// Package service holds the business rules (AD-1). It depends only on the repository
// interface — never on Gin or HTTP concerns. In Story 1.1 the surface is small
// (list + health); validation and status-transition rules land in later stories.
package service

import (
	"context"

	"github.com/todo-app/api/model"
	"github.com/todo-app/api/repository"
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

// Health reports whether the datastore is reachable (readiness for GET /health).
func (s *Service) Health(ctx context.Context) error {
	return s.repo.Ping(ctx)
}
