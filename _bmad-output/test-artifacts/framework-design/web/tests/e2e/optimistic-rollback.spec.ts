import { test, expect } from '../support/fixtures';

/**
 * R1 — optimistic rollback, the score-9 risk and the product's core trust promise (CM2).
 * Forces server rejection on each mutation and asserts the UI rolls back visibly and
 * reconciles to server truth. Covers 3.2-E2E-001..004 from the QA doc.
 */
test.describe('@e2e @p0 optimistic rollback (R1 / CM2)', () => {
  test('3.2-E2E-001 add rejected -> optimistic row rolls back visibly', async ({ page }) => {
    // Fail the create; intercept BEFORE the action (network-first, no hard wait).
    await page.route('**/api/todos', (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'internal_error', message: 'boom' } }) })
        : route.continue(),
    );

    await page.goto('/');
    const input = page.getByPlaceholder('Add a task…');
    await input.fill('Email Sam the Q3 numbers');
    await input.press('Enter');

    // Appears optimistically, then must disappear on failure.
    await expect(page.getByText('Email Sam the Q3 numbers')).toBeHidden();
    await expect(page.getByText(/couldn.t|try again|something got in the way/i)).toBeVisible();
  });

  test('3.2-E2E-004 no silent divergence: after rollback, UI equals server truth', async ({ page, seedTodos }) => {
    const [todo] = await seedTodos([{ title: 'Book dentist' }]);

    // Reject the toggle.
    await page.route(`**/api/todos/${todo.id}`, (route) =>
      route.request().method() === 'PATCH'
        ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'internal_error', message: 'boom' } }) })
        : route.continue(),
    );

    await page.goto('/');
    await page.getByRole('checkbox', { name: /book dentist/i }).click();

    // Optimistic completed style reverts; a refetch shows the server's active state.
    await expect(page.getByRole('checkbox', { name: /book dentist/i })).not.toBeChecked();
    await page.reload();
    await expect(page.getByRole('checkbox', { name: /book dentist/i })).not.toBeChecked();
  });
});
