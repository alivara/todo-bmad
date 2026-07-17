import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * web unit tests: TanStack mutation logic, optimistic rollback reducers [R1],
 * relative-time formatter [R9], rune-count parity [R8]. Fast, no browser.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'tests/integration/**', 'node_modules/**'],
    setupFiles: ['./tests/support/vitest.setup.ts'], // RTL matchers + fake timers
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      thresholds: { lines: 80, functions: 80, branches: 70 }, // ≥80% per priorities matrix
    },
  },
});
