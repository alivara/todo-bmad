import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { faker } from '@faker-js/faker';

/**
 * Shared Playwright fixtures for todo-app.
 *   - seedTodos           -> create rows via the api (TC1), fast setup, never via the UI
 *   - resetTodos          -> truncate list state between tests via the test-only reset
 *                            endpoint (compiled in only under the `testseed` build tag)
 *
 * Story 1.2 predates DELETE (Story 2.3), so cleanup uses the reset endpoint rather than
 * per-id DELETE. That makes reset a full truncate, so the suite runs serially.
 */

export type NewTodo = { title: string; description?: string };

export function makeTodo(overrides: Partial<NewTodo> = {}): NewTodo {
  return { title: `task ${faker.string.uuid()}`, description: '', ...overrides };
}

type Fixtures = {
  /** Seed N todos via the api. Returns created resources. Cleanup truncates in afterEach. */
  seedTodos: (items: NewTodo[]) => Promise<unknown[]>;
};

export const test = base.extend<Fixtures>({
  seedTodos: async ({ request }, use) => {
    const created: unknown[] = [];
    const seed = async (items: NewTodo[]) => {
      for (const item of items) {
        const res = await request.post('/api/todos', { data: item });
        expect(res.status()).toBe(201);
        created.push(await res.json());
      }
      return created;
    };
    await use(seed);
    // Auto-cleanup [TC1]: truncate so parallel/serial runs stay isolated.
    await resetTodos(request);
  },
});

/**
 * Reset all list state via the test-only endpoint (POST /internal/test/reset, proxied at
 * /api/internal/test/reset). It exists only in the `testseed` api build — a 404 means the
 * stack was brought up without docker-compose.test.yml, so fail loudly.
 */
export async function resetTodos(request: APIRequestContext) {
  const res = await request.post('/api/internal/test/reset');
  expect(
    res.status(),
    'reset endpoint missing — bring the stack up with docker-compose.test.yml (testseed build)',
  ).toBe(204);
}

export { expect };
