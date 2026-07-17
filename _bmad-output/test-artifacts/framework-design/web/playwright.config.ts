import { defineConfig, devices } from '@playwright/test';

/**
 * todo-app E2E + api-integration config.
 * The browser talks to `web` same-origin; `web` proxies /api/* to `api` (AD-3).
 * CI gates on the api readiness route [TC5] before running.
 */
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  // e2e = through the browser; integration = api boundary via request context.
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

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0, // burn-in flakes surface locally, not masked
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : 'list',

  use: {
    trace: 'retain-on-failure', // keep the trace whenever a test ends failed (incl. after retries)
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // No global timeout crutch; tests use network-first + fake clock, never waitForTimeout.
  },

  // Bring the stack up for local runs; CI uses `docker compose up` + this as a health gate [TC5].
  webServer: process.env.CI
    ? undefined
    : {
        command: 'docker compose up --build',
        url: `${BASE_URL}/health`, // wait for api readiness via the web proxy
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
