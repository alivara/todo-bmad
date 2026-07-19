import { test, expect, resetTodos } from '../support/fixtures';

/**
 * 3.4-E2E — warm-dark theme toggle (P0). The real FOUC/RD-6 home: the no-flash inline script and
 * first-load OS honoring can't be exercised in jsdom, so they're gated here in a real browser.
 *
 * Coverage:
 *   (a) toggle flips <html data-theme> and the choice persists across a reload;
 *   (b) a stored 'dark' pref → first paint is dark (addInitScript seeds storage before the app runs);
 *   (c) no stored pref + OS dark (colorScheme:'dark') → first paint dark (RD-6);
 *   (d) stored 'light' + OS dark → light (a stored choice overrides the OS).
 */
test.describe('@e2e @p0 warm-dark theme toggle', () => {
  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('3.4-E2E-001 toggle flips data-theme and persists across reload', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    // Default: no stored pref, OS light → light.
    await expect(html).toHaveAttribute('data-theme', 'light');

    await page.getByRole('button', { name: /toggle theme/i }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    // The choice sticks (localStorage) and is applied before paint on reload.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('3.4-E2E-002 a stored dark pref is applied on first paint', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('todo-theme', 'dark'));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test.describe('OS prefers-color-scheme: dark', () => {
    test.use({ colorScheme: 'dark' });

    test('3.4-E2E-003 no stored pref + OS dark → first paint dark (RD-6)', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    });

    test('3.4-E2E-004 stored light overrides an OS-dark default', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('todo-theme', 'light'));
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    });
  });
});
