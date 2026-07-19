//go:build testseed

// Injection-inertness at the persistence boundary (AC8 / AD-10, risk R4). This proves the
// thing a stub-repo unit test cannot: that a SQL-injection payload sent through the REAL
// parameterized INSERT is stored as literal text and never executed. It is guarded by the
// `testseed` build tag (same seam as testhelpers) so it runs only under `go test -tags
// testseed` against a live Postgres (docker-compose.test.yml), and skips cleanly otherwise.
package repository

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/todo-app/api/testhelpers"
)

func TestCreateTodo_SQLInjectionPayloadIsInert(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL not set; this integration test needs a live Postgres (docker-compose.test.yml)")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect to postgres: %v", err)
	}
	defer pool.Close()

	// Isolate from any other rows so the count assertion is exact.
	if err := testhelpers.ResetTodos(ctx, pool); err != nil {
		t.Fatalf("reset todos: %v", err)
	}

	repo := NewPostgres(pool)

	// Classic injection attempt: if the payload were concatenated into the SQL rather than
	// bound as a parameter, this would drop the table. It must be stored verbatim instead.
	const payload = "'; DROP TABLE todos; --"

	created, err := repo.CreateTodo(ctx, payload, "")
	if err != nil {
		t.Fatalf("CreateTodo with injection payload returned error: %v", err)
	}
	if created.Title != payload {
		t.Errorf("payload should be stored as literal text, got %q, want %q", created.Title, payload)
	}

	// The table must still exist and be queryable (it was not dropped), and it must contain
	// exactly the one row we inserted — with the payload intact.
	todos, err := repo.ListTodos(ctx)
	if err != nil {
		t.Fatalf("ListTodos after injection payload failed (table dropped?): %v", err)
	}
	if len(todos) != 1 {
		t.Fatalf("expected exactly 1 row after injection insert, got %d", len(todos))
	}
	if todos[0].Title != payload {
		t.Errorf("stored title = %q, want literal payload %q", todos[0].Title, payload)
	}
}
