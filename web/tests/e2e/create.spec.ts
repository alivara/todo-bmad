import { test, expect, resetTodos } from '../support/fixtures';
import { assertTodoShape } from '../support/contract';

/**
 * 1.4-E2E — core capture loop (Story 1.2 create + Story 1.3 view), P0.
 * The happy path the product exists for: type a task, it appears instantly at the top,
 * the input stays ready, and it survives a reload. Network-first (no hard waits); setup
 * goes through the api via fixtures, never the UI. Each test starts from an empty list.
 */
test.describe('@e2e @p0 create + view core loop', () => {
  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('1.4-E2E-001 add a task -> appears optimistically at top, input clears and keeps focus', async ({
    page,
  }) => {
    await page.goto('/');

    const input = page.getByPlaceholder('Add a task…');
    await expect(input).toBeFocused(); // pinned + focused on load

    await input.fill('Email Sam the Q3 numbers');
    await input.press('Enter');

    // Optimistic insert at the top (FR2) + input clears and keeps focus (FR4).
    const rows = page.getByRole('listitem');
    await expect(rows.first()).toContainText('Email Sam the Q3 numbers');
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
  });

  test('1.4-E2E-002 empty/whitespace title is rejected inline, no row created, no request sent', async ({
    page,
  }) => {
    let postSeen = false;
    await page.route('**/api/todos', (route) => {
      if (route.request().method() === 'POST') postSeen = true;
      return route.continue();
    });

    await page.goto('/');
    const input = page.getByPlaceholder('Add a task…');
    await input.fill('   '); // whitespace only
    await input.press('Enter');

    await expect(page.getByRole('listitem')).toHaveCount(0);
    await expect(input).toBeFocused();
    expect(postSeen).toBe(false); // rejected client-side, nothing sent (FR3)
  });

  test('1.4-E2E-003 newest-first ordering — a second add lands above the first', async ({ page }) => {
    await page.goto('/');
    const input = page.getByPlaceholder('Add a task…');

    await input.fill('First task');
    await input.press('Enter');
    await expect(page.getByRole('listitem').first()).toContainText('First task');
    await input.fill('Second task');
    await input.press('Enter');

    const rows = page.getByRole('listitem');
    await expect(rows.first()).toContainText('Second task'); // newest-first (FR8)
    await expect(rows.nth(1)).toContainText('First task');
  });

  test('1.4-E2E-004 persistence — a created task survives reload and loads automatically', async ({
    page,
  }) => {
    await page.goto('/');
    const input = page.getByPlaceholder('Add a task…');
    await input.fill('Book dentist');
    await input.press('Enter');
    await expect(page.getByRole('listitem').first()).toContainText('Book dentist');

    await page.reload();

    // Loads automatically on open (FR5), still present (FR17 durability).
    await expect(page.getByRole('listitem').first()).toContainText('Book dentist');
  });

  test('1.4-INT-001 GET /todos returns the fixed wire shape after a seeded create', async ({
    seedTodos,
    request,
  }) => {
    await seedTodos([{ title: 'Contract check', description: '' }]);

    const res = await request.get('/api/todos');
    expect(res.status()).toBe(200);
    const body = await res.json();

    expect(Array.isArray(body)).toBe(true); // bare array, [] never null
    assertTodoShape(body[0]); // camelCase, metadata nesting, "" not null, uuid, RFC3339 Z
  });
});
