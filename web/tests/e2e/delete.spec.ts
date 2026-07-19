import { test, expect, resetTodos } from '../support/fixtures';

/**
 * Story 2.3 — delete a task with undo (AD-5), P0. The pending-delete lifecycle is entirely
 * client-side: the ✕ removes the row optimistically with NO network call and starts a client-owned
 * ~5s window; an Undo toast restores it in place with no round-trip; on elapse the real DELETE
 * fires (204/404 = success); a 5xx commit resurrects the row (RD-5).
 *
 * `page.clock` installs a controllable fake clock so the 5000ms window can be fast-forwarded
 * deterministically. Setup goes through the api via fixtures, never the UI. Network-first — the
 * commit DELETE is observed via waitForRequest, not a hard wait.
 */
test.describe('@e2e @p0 delete a task with undo (Story 2.3 / AD-5)', () => {
  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('2.3-E2E-001 delete removes the row + shows the toast with NO DELETE while pending; fast-forward commits it', async ({
    page,
    seedTodos,
  }) => {
    await seedTodos([{ title: 'Ship the release' }]);
    await page.clock.install();
    await page.goto('/');

    const deletes: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'DELETE') deletes.push(req.url());
    });

    await expect(page.getByText('Ship the release')).toBeVisible();

    // Activate the quiet ✕: the row vanishes optimistically and the Undo toast appears.
    await page.getByRole('button', { name: 'Delete Ship the release' }).click();
    await expect(page.getByText('Ship the release')).toHaveCount(0);
    await expect(page.getByText('Task deleted')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();

    // Inside the window: NO network call has fired (AD-5).
    await page.clock.fastForward(4000);
    expect(deletes).toHaveLength(0);

    // Cross the boundary → the real DELETE fires once (network-first).
    const [req] = await Promise.all([
      page.waitForRequest((r) => r.method() === 'DELETE' && r.url().includes('/api/todos/')),
      page.clock.fastForward(1500),
    ]);
    expect(req.method()).toBe('DELETE');

    // Committed: a reload still shows it gone.
    await page.reload();
    await expect(page.getByText('Ship the release')).toHaveCount(0);
  });

  test('2.3-E2E-002 undo within the window restores the row in place and the DELETE never fires', async ({
    page,
    seedTodos,
  }) => {
    await seedTodos([{ title: 'Book the venue' }]);
    await page.clock.install();
    await page.goto('/');

    const deletes: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'DELETE') deletes.push(req.url());
    });

    await page.getByRole('button', { name: 'Delete Book the venue' }).click();
    await expect(page.getByText('Book the venue')).toHaveCount(0);

    // Undo restores the row instantly (no round-trip).
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Book the venue')).toBeVisible();
    await expect(page.getByText('Task deleted')).toHaveCount(0);

    // Even past the window, the cancelled timer never commits — no DELETE observed.
    await page.clock.fastForward(6000);
    expect(deletes).toHaveLength(0);
  });

  test('2.3-E2E-003 a failed commit (5xx) resurrects the row at its place with a retryable error', async ({
    page,
    seedTodos,
  }) => {
    await seedTodos([{ title: 'Send the invoices' }]);
    await page.clock.install();

    // Fail the commit DELETE with a 500 (the GET/other methods pass through).
    await page.route('**/api/todos/**', (route) =>
      route.request().method() === 'DELETE'
        ? route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'internal_error', message: 'boom' } }),
          })
        : route.continue(),
    );

    await page.goto('/');

    await page.getByRole('button', { name: 'Delete Send the invoices' }).click();
    await expect(page.getByText('Send the invoices')).toHaveCount(0);

    // Elapse the window → the commit fires, fails, and the row resurrects + a retryable error shows.
    await page.clock.fastForward(5000);
    await expect(page.getByText('Send the invoices')).toBeVisible();
    await expect(page.getByText('Something got in the way. Try again.')).toBeVisible();
  });
});
