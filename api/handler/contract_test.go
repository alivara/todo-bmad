package handler

import (
	"encoding/json"
	"sort"
	"testing"
	"time"

	"github.com/todo-app/api/model"
)

// AC7 / R3 — contract-drift guard. The Go wire serializer (wire.go) and the single
// source-of-truth type in shared/todo.ts must not diverge. This test pins the exact JSON
// key set the api emits; if wire.go changes a field name, its casing, or the metadata
// nesting, this fails — turning a silent client/api divergence into a red build.
//
// Keep these expectations in lockstep with shared/todo.ts:
//
//	Todo         -> id, title, description, status, metadata   (camelCase)
//	TodoMetadata -> createdAt, updatedAt                        (nested, camelCase)
func TestWireContract_MatchesSharedTodoShape(t *testing.T) {
	ts := time.Date(2026, 7, 17, 14, 3, 11, 0, time.UTC)
	resp := toTodoResponse(model.Todo{
		ID:          "22222222-2222-4222-8222-222222222222",
		Title:       "buy milk",
		Description: "", // empty must serialize as "" (never null)
		Status:      model.StatusActive,
		CreatedAt:   ts,
		UpdatedAt:   ts,
	})

	raw, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}

	// Decode with json.RawMessage so we can distinguish "" from null on description.
	var top map[string]json.RawMessage
	if err := json.Unmarshal(raw, &top); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	assertExactKeys(t, "todo", top, []string{"description", "id", "metadata", "status", "title"})

	if string(top["description"]) != `""` {
		t.Fatalf("description = %s, want \"\" (never null)", top["description"])
	}

	var meta map[string]json.RawMessage
	if err := json.Unmarshal(top["metadata"], &meta); err != nil {
		t.Fatalf("metadata is not a nested object: %v", err)
	}
	assertExactKeys(t, "metadata", meta, []string{"createdAt", "updatedAt"})
}

func assertExactKeys(t *testing.T, label string, m map[string]json.RawMessage, want []string) {
	t.Helper()
	got := make([]string, 0, len(m))
	for k := range m {
		got = append(got, k)
	}
	sort.Strings(got)
	sort.Strings(want)
	if len(got) != len(want) {
		t.Fatalf("%s keys = %v, want %v", label, got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("%s keys = %v, want %v (drift from shared/todo.ts)", label, got, want)
		}
	}
}
