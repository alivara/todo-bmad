import { expect } from '@playwright/test';

/**
 * AD-6 wire-contract assertions [R3]. One place both e2e and integration reuse, so a
 * client/api divergence fails a test the same way everywhere. Mirrors the shared/ source
 * of truth (shared/todo.ts) and the Go serializer's contract test.
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RFC3339_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** Assert a single todo matches the fixed wire shape (camelCase, metadata nesting, "" not null). */
export function assertTodoShape(todo: Record<string, unknown>) {
  expect(todo.id).toMatch(UUID_V4);
  expect(typeof todo.title).toBe('string');
  expect(typeof todo.description).toBe('string'); // "" never null
  expect(['active', 'completed']).toContain(todo.status);
  const meta = todo.metadata as { createdAt?: string; updatedAt?: string } | undefined;
  expect(meta?.createdAt).toMatch(RFC3339_Z); // timestamps nested, UTC Z
  expect(meta?.updatedAt).toMatch(RFC3339_Z);
  expect(todo).not.toHaveProperty('created_at'); // snake_case must not leak to the wire
}

/** GET /todos returns a bare array, [] (never null) when empty. */
export function assertCollectionShape(body: unknown) {
  expect(Array.isArray(body)).toBe(true);
}
