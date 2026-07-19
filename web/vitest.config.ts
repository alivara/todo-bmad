import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      // Meaningful code coverage = the app + lib source the browser and BFF proxy run.
      // Enforced floor is the project bar (≥70%); the suite currently sits well above it.
      provider: 'v8',
      include: ['app/**', 'lib/**'],
      reporter: ['text', 'text-summary', 'json-summary', 'html'],
      thresholds: { statements: 70, branches: 70, functions: 70, lines: 70 },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
});
