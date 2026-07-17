import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { faker } from '@faker-js/faker';

/**
 * Shared Playwright fixtures for todo-app.
 * Enablers from the test-design risk review:
 *   - seedTodos / resetTodos  -> TC1 test-data seam (parallel-safe, self-cleaning)
 *   - installClock            -> R9 deterministic time (undo window, relative time)
 * All setup goes through the api (fast), never the UI.
 */

export type NewTodo = { title: string; description?: string };

export function makeTodo(overrides: Partial<NewTodo> = {}): NewTodo {
  return { title: `task ${faker.string.uuid()}`, description: '', ...overrides };
}

type Fixtures = {
  /** Seed N todos via the api; auto-reset after the test. Returns created resources. */
  seedTodos: (items: NewTodo[]) => Promise<any[]>;
};

export const test = base.extend<Fixtures>({
  seedTodos: async ({ request }, use) => {
    const created: any[] = [];
    const seed = async (items: NewTodo[]) => {
      for (const item of items) {
        const res = await request.post('/api/todos', { data: item });
        expect(res.status()).toBe(201);
        created.push(await res.json());
      }
      return created;
    };
    await use(seed);
    // Auto-cleanup [TC1]: remove everything this test created so parallel runs stay isolated.
    await resetTodos(request, created.map((t) => t.id));
  },
});

/** Delete specific ids (or call the test-only reset endpoint if the api exposes one). */
export async function resetTodos(request: APIRequestContext, ids: string[]) {
  await Promise.all(ids.map((id) => request.delete(`/api/todos/${id}`)));
}

/**
 * Fake clock for the ~5s undo window (AD-5) and relative-time render (FR6).
 * Usage: await installClock(page); ... await page.clock.fastForward(5000);
 * Bans reliance on real time -> kills R9 flakiness. Never use waitForTimeout.
 */
export async function installClock(page: import('@playwright/test').Page, now = '2026-07-17T14:03:11Z') {
  await page.clock.install({ time: new Date(now) });
}

export { expect };
