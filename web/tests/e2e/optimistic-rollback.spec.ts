import { test, expect, resetTodos } from '../support/fixtures';

/**
 * R1 — optimistic rollback, the score-9 risk and the product's core trust promise (CM2).
 * Story 1.2 owns the ADD path (3.2-E2E-001). The edit/toggle/delete rollback paths land in
 * Epic 2, and the systematized cross-mutation rollback in Epic 3 (Story 3.1/3.2).
 */
test.describe('@e2e @p0 optimistic rollback — add path (R1 / CM2)', () => {
  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('3.2-E2E-001 add rejected -> optimistic row rolls back visibly + error shown', async ({ page }) => {
    // Fail the create; intercept BEFORE the action (network-first, no hard wait).
    await page.route('**/api/todos', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: { code: 'internal_error', message: 'boom' } }),
          })
        : route.continue(),
    );

    await page.goto('/');
    const input = page.getByPlaceholder('Add a task…');
    await input.fill('Email Sam the Q3 numbers');
    await input.press('Enter');

    // Appears optimistically, then must disappear on failure, and an error is surfaced.
    // Assert the alert REGION (robust to its internal structure: Story 3.1's 5xx surface splits
    // the copy into a message span + a "Try again" button, so a loose getByText regex would match
    // two nodes — strict-mode violation. The role=alert container is the stable contract).
    await expect(page.getByText('Email Sam the Q3 numbers')).toBeHidden();
    await expect(page.getByRole('alert')).toContainText(/couldn.t|try again|something got in the way/i);
  });
});
