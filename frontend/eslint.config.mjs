import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts', 'next.config.mjs'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  // Test files also run under Vitest globals-free (we import explicitly), so no extra config needed.
  prettier,
);
