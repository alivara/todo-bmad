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
    // Next's route announcer (#__next-route-announcer__) also has role="alert" but is empty, so an
    // unfiltered getByRole('alert') is strict-mode ambiguous (surfaces on mobile). Filtering by the
    // rollback copy (alert has name-from-content=false, so filter by text, not { name }) excludes the
    // announcer AND won't false-pass on a *different* alert, while keeping the role assertion.
    await expect(page.getByRole('alert').filter({ hasText: /something got in the way/i })).toBeVisible();
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');
  });
});

/**
 * Story 2.1 — the completed-state PAYOFF under reduced motion (AC2 / 2.1-R9). The spring
 * (check-pop) is decoration; `prefers-reduced-motion: reduce` disables it. This asserts that
 * the functional payoff STILL applies without the animation — the checkbox flips to completed
 * AND the card recedes to the "done" treatment — proving motion decorates but never gates the
 * state change. The recede is carried by chrome (transparent surface + no shadow + line-through),
 * NOT by dimming the text with opacity — Story 3.5 keeps the text full-opacity so completed copy
 * stays WCAG AA. The chrome swap (background/box-shadow) is the robust, meaningful visual signal.
 */
test.describe('@e2e @p0 completed payoff under reduced motion (2.1 / AC2)', () => {
  test.use({ reducedMotion: 'reduce' });

  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('2.1-E2E-003 completed card recedes (chrome, not opacity) with motion disabled — motion never gates', async ({
    page,
    seedTodos,
  }) => {
    await seedTodos([{ title: 'Reduced-motion payoff' }]);

    await page.goto('/');
    const checkbox = page.getByRole('checkbox', { name: /Reduced-motion payoff/i });
    await expect(checkbox).toHaveAttribute('aria-checked', 'false');

    // Active treatment: a raised card — an opaque surface with a shadow.
    const card = page.locator('.todo-card');
    await expect(card).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(card).not.toHaveCSS('box-shadow', 'none');

    await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/todos/') && req.method() === 'PATCH'),
      checkbox.click(),
    ]);

    // The state change lands regardless of motion...
    await expect(checkbox).toHaveAttribute('aria-checked', 'true');

    // ...and the recede applies without the animation: the card drops to a transparent surface with
    // no shadow (the "done" treatment). Story 3.5 carries the recede via chrome + line-through, NOT
    // via opacity — the text stays at full opacity (opacity:1) so it remains WCAG AA. Poll so the
    // 350ms background/box-shadow transition can settle.
    await expect(card).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(card).toHaveCSS('box-shadow', 'none');
    await expect(card).toHaveCSS('opacity', '1');
  });
});
