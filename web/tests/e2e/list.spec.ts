import { test, expect, resetTodos } from '../support/fixtures';

/**
 * Story 1.3 — view the persistent task list, P0. Row anatomy + order fidelity.
 *
 * The UI-driven newest-first ordering (1.4-E2E-003) and persistence-across-reload
 * (1.4-E2E-004) already live in create.spec.ts, so this suite does not repeat them.
 * Here we seed through the api and assert (a) the client renders the server-received
 * order verbatim with NO client re-sort (AD-4), and (b) a row's full anatomy —
 * title, description, RD-1 relative time, and the in-place more/less reveal.
 *
 * Network-first, no hard waits; setup goes through the api via fixtures, never the UI.
 */
test.describe('@e2e @p0 view the persistent list (Story 1.3)', () => {
  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('1.3-E2E-001 renders todos in the server-received order — no client re-sort', async ({
    page,
    request,
    seedTodos,
  }) => {
    await seedTodos([{ title: 'Alpha task' }, { title: 'Bravo task' }, { title: 'Charlie task' }]);

    // The server ordering (created_at DESC, id DESC) is the contract; the client must
    // render it verbatim. Take the server's order as ground truth, then assert the DOM
    // matches it position-for-position — a client re-sort would diverge here.
    const res = await request.get('/api/todos');
    expect(res.status()).toBe(200);
    const serverTitles = ((await res.json()) as { title: string }[]).map((t) => t.title);
    expect(serverTitles).toHaveLength(3);

    await page.goto('/');
    const rows = page.getByRole('listitem');
    await expect(rows).toHaveCount(3);
    for (let i = 0; i < serverTitles.length; i++) {
      await expect(rows.nth(i)).toContainText(serverTitles[i]);
    }
  });

  test('1.3-E2E-002 a row shows its title, description and an RD-1 relative time', async ({
    page,
    seedTodos,
  }) => {
    await seedTodos([{ title: 'Email Sam the Q3 numbers', description: 'Attach the latest deck' }]);

    // Freeze the client clock so the relative-time label is deterministic; a freshly
    // seeded row falls in the RD-1 "just now" bucket.
    await page.clock.install({ time: new Date() });
    await page.goto('/');

    const row = page.getByRole('listitem').first();
    await expect(row).toContainText('Email Sam the Q3 numbers');
    await expect(row).toContainText('Attach the latest deck');
    await expect(row).toContainText('just now');
  });

  test('1.3-E2E-003 a long description clamps with a more reveal that expands in place', async ({
    page,
    seedTodos,
  }) => {
    const long =
      'This is a deliberately long description ' +
      'that keeps going and going '.repeat(8) +
      'so the row must clamp it to two lines.';
    await seedTodos([{ title: 'Plan the offsite', description: long }]);

    await page.goto('/');
    const row = page.getByRole('listitem').first();

    const more = row.getByRole('button', { name: 'more' });
    await expect(more).toBeVisible();
    await more.click();

    // Expands in place: a "less" toggle appears and NO edit affordance (textbox) does.
    await expect(row.getByRole('button', { name: 'less' })).toBeVisible();
    await expect(row.getByRole('textbox')).toHaveCount(0);

    await row.getByRole('button', { name: 'less' }).click();
    await expect(row.getByRole('button', { name: 'more' })).toBeVisible();
  });

  test('1.3-E2E-004 a long unbroken title wraps and never forces horizontal scroll (~375px)', async ({
    page,
    seedTodos,
  }) => {
    // A title can be up to 200 unbroken code points (a pasted URL). At the mobile floor it
    // must wrap, not push the page wider than the viewport (title overflowWrap, review F3).
    await page.setViewportSize({ width: 375, height: 800 });
    await seedTodos([{ title: `https://example.com/${'a'.repeat(180)}` }]);

    await page.goto('/');
    await expect(page.getByRole('listitem')).toHaveCount(1);

    const overflows = await page.evaluate(() => {
      const el = document.scrollingElement!;
      return el.scrollWidth > el.clientWidth;
    });
    expect(overflows).toBe(false);
  });
});
