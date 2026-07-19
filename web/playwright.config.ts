import { defineConfig, devices } from '@playwright/test';

/**
 * todo-app E2E + api-integration config.
 * The browser talks to `web` same-origin; `web` proxies /api/* to `api` (AD-3).
 *
 * The suites reset list state between tests via the test-only reset endpoint, which is
 * compiled in only under the `testseed` build tag — so the stack must be brought up with
 * the test override:
 *
 *   docker compose -f docker-compose.yml -f docker-compose.test.yml up --build
 *
 * Reset truncates the shared table, so tests run serially (workers: 1) — DELETE-based
 * per-id cleanup (which would allow parallelism) lands with Story 2.3.
 */
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  projects: [
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'], baseURL: BASE_URL },
    },
    {
      name: 'e2e-mobile',
      testDir: './tests/e2e',
      // NFR5 / UX-DR17: functional + polished from ~375px up.
      use: { ...devices['iPhone SE'], baseURL: BASE_URL },
    },
    {
      name: 'integration',
      testDir: './tests/integration',
      use: { baseURL: BASE_URL },
    },
  ],

  fullyParallel: false,
  workers: 1, // reset truncates the shared table; keep tests serial until DELETE (2.3)
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',

  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // No hard-wait crutch; tests use network-first synchronization, never waitForTimeout.
  },

  // Reuse an already-running stack (brought up with the test override above); otherwise
  // build + start it. Gate on api readiness through the web proxy.
  webServer: process.env.CI
    ? undefined
    : {
        command: 'docker compose -f ../docker-compose.yml -f ../docker-compose.test.yml up --build',
        url: `${BASE_URL}/api/health`,
        reuseExistingServer: true,
        timeout: 240_000,
      },
});
