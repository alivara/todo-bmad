import { test, expect, resetTodos } from '../support/fixtures';

/**
 * Security response headers (Story 3.5, SEC-1). Asserts the CSP + hardening headers configured in
 * `web/next.config.mjs` (`async headers()`, source '/:path*') are actually served — on the page
 * response AND on an /api/* proxy response, so both the app and the API surface carry them.
 *
 * Left untagged (not @p0) so the full `test:e2e` run picks it up alongside the other specs.
 */
test.describe('security response headers', () => {
  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('3.5-SEC-001 serves CSP + hardening headers on the page response', async ({ page }) => {
    const res = await page.request.get('/');
    const h = res.headers();

    const csp = h['content-security-policy'];
    expect(csp, 'CSP header present on /').toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    // 'unsafe-inline' must stay on script-src for the inline theme script + Next's runtime.
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");

    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['referrer-policy']).toBeTruthy();
  });

  test('3.5-SEC-002 serves the CSP header on an /api/* response too', async ({ page }) => {
    // /api/health is the API readiness probe, proxied through the Next /api/[...path] route — the
    // `/:path*` header rule covers it, so the CSP must be present here as well.
    const res = await page.request.get('/api/health');
    const h = res.headers();
    expect(h['content-security-policy'], 'CSP header present on /api/*').toBeTruthy();
    expect(h['content-security-policy']).toContain("default-src 'self'");
  });
});
