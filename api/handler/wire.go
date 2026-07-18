package handler

import (
	"time"

	"github.com/todo-app/api/model"
)

// The wire (serialization) layer. It maps the flat domain model.Todo to the AD-6 wire
// shape: camelCase fields, timestamps NESTED under metadata, formatted RFC3339 UTC with
// a trailing Z at second precision (AD-7). Keeping this here — not on the domain model —
// is what lets model.Todo stay a plain domain type. The shape mirrors shared/todo.ts.

type todoResponse struct {
	ID          string       `json:"id"`
	Title       string       `json:"title"`
	Description string       `json:"description"`
	Status      string       `json:"status"`
	Metadata    wireMetadata `json:"metadata"`
}

type wireMetadata struct {
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// formatTS renders a timestamp as RFC3339 UTC, second precision (e.g. 2026-07-17T14:03:11Z).
func formatTS(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}

func toTodoResponse(t model.Todo) todoResponse {
	return todoResponse{
		ID:          t.ID,
		Title:       t.Title,
		Description: t.Description,
		Status:      t.Status,
		Metadata: wireMetadata{
			CreatedAt: formatTS(t.CreatedAt),
			UpdatedAt: formatTS(t.UpdatedAt),
		},
	}
}

// toTodoResponses maps a slice of domain todos to wire responses. It always returns a
// non-nil slice so an empty list serializes as [] (AD-6), never null.
func toTodoResponses(todos []model.Todo) []todoResponse {
	out := make([]todoResponse, 0, len(todos))
	for _, t := range todos {
		out = append(out, toTodoResponse(t))
	}
	return out
}
