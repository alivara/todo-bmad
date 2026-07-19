import { test, expect, resetTodos } from '../support/fixtures';

/**
 * Story 2.2 — edit-a-task-in-place + its rollback, the trust promise (AD-4/AD-6). Seeds rows via
 * the api (never the UI), taps the title/description to open the inline editor, and asserts the
 * observed PATCH carries ONLY the changed fields (absent = unchanged), the change persists across
 * reload, an intentional description clear sends description:"", a route-forced 500 rolls the row
 * back to its pre-edit values, and a no-op edit issues no PATCH. Network-first synchronization
 * throughout — no hard waits.
 */
test.describe('@e2e @p0 edit a task in place — PATCH changed-fields + rollback (2.2 / AD-6)', () => {
  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('2.2-E2E-001 tap title -> edit -> Enter -> PATCH {title} only -> reload persists', async ({
    page,
    seedTodos,
  }) => {
    await seedTodos([{ title: 'Email Sam the Q3 numbers', description: 'Attach the deck' }]);

    await page.goto('/');
    // Tap the title text to enter the inline editor.
    await page.getByText('Email Sam the Q3 numbers').click();
    const titleField = page.getByRole('textbox', { name: 'Edit title' });
    await expect(titleField).toBeVisible();
    await expect(page.getByText('Enter to save · Esc to cancel')).toBeVisible();

    // Change the title and confirm with Enter; observe the PATCH carrying ONLY { title } (AD-6).
    await titleField.fill('Email Sam the Q4 numbers');
    const [patchReq] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/todos/') && req.method() === 'PATCH'),
      titleField.press('Enter'),
    ]);
    expect(JSON.parse(patchReq.postData() ?? '{}')).toEqual({ title: 'Email Sam the Q4 numbers' });

    // Optimistic update settled + description left intact.
    await expect(page.getByText('Email Sam the Q4 numbers')).toBeVisible();
    await expect(page.getByText('Attach the deck')).toBeVisible();

    // Persisted: a reload still shows the edited title.
    await page.reload();
    await expect(page.getByText('Email Sam the Q4 numbers')).toBeVisible();
  });

  test('2.2-E2E-002 clear the description -> PATCH {description:""} (present, empty)', async ({
    page,
    seedTodos,
  }) => {
    await seedTodos([{ title: 'Book the venue', description: 'Confirm the deposit' }]);

    await page.goto('/');
    await page.getByText('Confirm the deposit').click();
    const descField = page.getByRole('textbox', { name: 'Edit description' });
    await expect(descField).toBeVisible();

    // Clear the description; save the whole editor via Enter in the title (title unchanged).
    await descField.fill('');
    const [patchReq] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/todos/') && req.method() === 'PATCH'),
      page.getByRole('textbox', { name: 'Edit title' }).press('Enter'),
    ]);
    // Intentional clear: description key PRESENT and empty, title OMITTED (unchanged — AD-6).
    const body = JSON.parse(patchReq.postData() ?? '{}');
    expect(body).toEqual({ description: '' });

    // Persisted clear survives a reload (the description line is gone).
    await page.reload();
    await expect(page.getByText('Book the venue')).toBeVisible();
    await expect(page.getByText('Confirm the deposit')).toHaveCount(0);
  });

  test('2.2-E2E-003 edit rejected (500) -> row visibly rolls back to its pre-edit values', async ({
    page,
    seedTodos,
  }) => {
    await seedTodos([{ title: 'Draft the proposal', description: 'Two pages max' }]);

    // Fail the PATCH; intercept BEFORE opening the editor (network-first, no hard wait).
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
    await page.getByText('Draft the proposal').click();
    const titleField = page.getByRole('textbox', { name: 'Edit title' });
    await titleField.fill('A different title');

    const [patchReq] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/todos/') && req.method() === 'PATCH'),
      titleField.press('Enter'),
    ]);
    expect(patchReq.method()).toBe('PATCH');

    // The rejection rolls the row back visibly to the pre-edit title + surfaces a non-disruptive
    // error. The optimistic intermediate is asserted deterministically in the gated unit test
    // (use-update-todo.test.tsx); here we assert the observable end state + the error surface.
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('Draft the proposal')).toBeVisible();
    await expect(page.getByText('A different title')).toHaveCount(0);
  });

  test('2.2-E2E-004 no-op edit (nothing changed) issues no PATCH', async ({ page, seedTodos }) => {
    await seedTodos([{ title: 'Renew the license', description: '' }]);

    // Record any PATCH that fires so we can assert none did.
    let patched = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/todos/') && req.method() === 'PATCH') patched = true;
    });

    await page.goto('/');
    await page.getByText('Renew the license').click();
    const titleField = page.getByRole('textbox', { name: 'Edit title' });
    await expect(titleField).toBeVisible();
    // Confirm without changing anything.
    await titleField.press('Enter');

    // Editor closes back to the display title; no PATCH was issued.
    await expect(page.getByRole('textbox', { name: 'Edit title' })).toHaveCount(0);
    await expect(page.getByText('Renew the license')).toBeVisible();
    expect(patched).toBe(false);
  });
});
