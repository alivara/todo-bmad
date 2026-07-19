import { test, expect, resetTodos } from '../support/fixtures';

/**
 * Story 2.1 — complete-a-task toggle (the payoff) + its rollback, the trust promise (AD-4).
 * Seeds an active row via the api (never the UI), toggles it through the real checkbox, and
 * asserts the completed style + the observed PATCH; then a second toggle back to active; then
 * the rollback path (mirrors optimistic-rollback.spec.ts): force a PATCH 500 and assert the
 * checkbox visibly flips back. Network-first synchronization throughout — no hard waits.
 */
test.describe('@e2e @p0 complete a task — toggle + rollback (2.1 / AD-4)', () => {
  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('2.1-E2E-001 toggle active -> completed persists (PATCH observed), then back to active', async ({
    page,
    seedTodos,
  }) => {
    await seedTodos([{ title: 'Email Sam the Q3 numbers' }]);

    await page.goto('/');
    const checkbox = page.getByRole('checkbox', { name: /Email Sam the Q3 numbers/i });
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');

    // Toggle to completed and observe the PATCH {status:'completed'} in flight (network-first).
    const [completeReq] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/todos/') && req.method() === 'PATCH'),
      checkbox.click(),
    ]);
    expect(JSON.parse(completeReq.postData() ?? '{}')).toMatchObject({ status: 'completed' });

    // The row settles into the completed style (checkbox checked, title struck through).
    await expect(checkbox).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('Email Sam the Q3 numbers')).toHaveCSS(
      'text-decoration-line',
      'line-through',
    );

    // Persisted: a reload still shows it completed.
    await page.reload();
    const reloaded = page.getByRole('checkbox', { name: /Email Sam the Q3 numbers/i });
    await expect(reloaded).toHaveAttribute('aria-checked', 'true');

    // Toggle back to active, observing PATCH {status:'active'}.
    const [activeReq] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/todos/') && req.method() === 'PATCH'),
      reloaded.click(),
    ]);
    expect(JSON.parse(activeReq.postData() ?? '{}')).toMatchObject({ status: 'active' });
    await expect(reloaded).toHaveAttribute('aria-checked', 'false');
  });

  test('2.1-E2E-002 toggle rejected (500) -> checkbox visibly flips back to prior state', async ({
    page,
    seedTodos,
  }) => {
    await seedTodos([{ title: 'Book the venue' }]);

    // Fail the PATCH; intercept BEFORE the click (network-first, no hard wait).
    await page.route('**/api/todos/**', (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'internal_error', message: 'boom' } }),
          })
        : route.continue(),
    );

    await page.goto('/');
    const checkbox = page.getByRole('checkbox', { name: /Book the venue/i });
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');

    // The click fires a PATCH (the toggle was attempted) which the route fails with 500.
    const [patchReq] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/todos/') && req.method() === 'PATCH'),
      checkbox.click(),
    ]);
    expect(patchReq.method()).toBe('PATCH');

    // The rejection rolls the checkbox back visibly to unchecked AND surfaces a non-disruptive
    // error (AC3). The fleeting optimistic 'true' intermediate is asserted deterministically in
    // the gated unit test (use-toggle-todo.test.tsx); here we assert the observable end state +
    // the error surface, so the test cannot pass on a no-op click (it starts unchecked too).
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');
  });
});

/**
 * Story 2.1 — the completed-state PAYOFF under reduced motion (AC2 / 2.1-R9). The spring
 * (check-pop) is decoration; `prefers-reduced-motion: reduce` disables it. This asserts that
 * the functional payoff STILL applies without the animation — the checkbox flips to completed
 * AND the card recedes to the ~0.85-opacity "done" treatment — proving motion decorates but
 * never gates the state change. Exact color matching is deliberately avoided (brittle); the
 * recessed opacity (an inline style value) is the robust, meaningful visual signal.
 */
test.describe('@e2e @p0 completed payoff under reduced motion (2.1 / AC2)', () => {
  test.use({ reducedMotion: 'reduce' });

  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('2.1-E2E-003 completed card recedes (~0.85 opacity) with motion disabled — motion never gates', async ({
    page,
    seedTodos,
  }) => {
    await seedTodos([{ title: 'Reduced-motion payoff' }]);

    await page.goto('/');
    const checkbox = page.getByRole('checkbox', { name: /Reduced-motion payoff/i });
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');

    await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/todos/') && req.method() === 'PATCH'),
      checkbox.click(),
    ]);

    // The state change lands regardless of motion...
    await expect(checkbox).toHaveAttribute('aria-checked', 'true');

    // ...and the recessed "done" card treatment applies — walk up from the checkbox to the
    // element that owns the receding opacity. Poll so the 350ms opacity transition can settle.
    await expect
      .poll(async () =>
        checkbox.evaluate((el) => {
          let node: HTMLElement | null = el as HTMLElement;
          while (node && getComputedStyle(node).opacity === '1') node = node.parentElement;
          return node ? getComputedStyle(node).opacity : '1';
        }),
      )
      .toBe('0.85');
  });
});
