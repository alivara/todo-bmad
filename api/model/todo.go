// Package model holds the api's domain types. It is the innermost layer — every
// other layer (handler, service, repository) may depend on it, and it depends on
// nothing internal, preserving the one-way dependency spine (AD-1).
package model

import "time"

// Todo is the domain representation of a todo. It is intentionally FLAT and free of
// wire concerns: timestamps are native time.Time, not pre-formatted strings, and there
// is no `metadata` nesting or json tags here. The AD-6 wire shape (camelCase, metadata
// nesting, RFC3339-Z formatting) is produced by the serializer at the HTTP boundary
// (see backend/handler/wire.go), keeping the domain model decoupled from the wire.
type Todo struct {
	ID          string
	Title       string
	Description string
	Status      string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// Allowed todo statuses (AD-8). Kept in sync with the DB CHECK constraint and, from
// Story 1.2, with service-layer validation.
const (
	StatusActive    = "active"
	StatusCompleted = "completed"
)

// ValidationError is a business-rule violation (AD-10) raised by the service layer and
// mapped by the handler to a 400 validation_error envelope (AD-9). Keeping the type in
// the innermost model package lets the handler detect it via errors.As WITHOUT importing
// the concrete service package — preserving the consumer-owned service interface (AD-1).
type ValidationError struct {
	Message string
}

func (e ValidationError) Error() string { return e.Message }

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
