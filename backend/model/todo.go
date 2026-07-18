// Package model holds the api's domain types. It is the innermost layer — every
// other layer (handler, service, repository) may depend on it, and it depends on
// nothing internal, preserving the one-way dependency spine (AD-1).
package model

// Todo mirrors the single source-of-truth wire contract in shared/todo.ts (AD-6).
// The json tags map Go's exported PascalCase to the camelCase wire shape; timestamps
// are NESTED under metadata; description is "" (never null). Any change here must be
// made in shared/todo.ts first and kept in lockstep (a contract test enforces this
// from Story 1.2).
type Todo struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Status      string   `json:"status"`
	Metadata    Metadata `json:"metadata"`
}

// Metadata carries the server-authoritative timestamps (AD-7): RFC3339 UTC with a
// trailing Z, second precision.
type Metadata struct {
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// Allowed todo statuses (AD-8). Kept in sync with the DB CHECK constraint and, from
// Story 1.2, with service-layer validation.
const (
	StatusActive    = "active"
	StatusCompleted = "completed"
)

// APIError is the uniform non-2xx envelope (AD-9): { "error": { "code", "message" } }.
type APIError struct {
	Error APIErrorBody `json:"error"`
}

// APIErrorBody is the inner payload of APIError.
type APIErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Error code vocabulary (AD-9) — a fixed set the client can branch on.
const (
	CodeValidationError = "validation_error"
	CodeNotFound        = "not_found"
	CodeInternalError   = "internal_error"
)

// NewAPIError builds an APIError with the given code and message.
func NewAPIError(code, message string) APIError {
	return APIError{Error: APIErrorBody{Code: code, Message: message}}
}
