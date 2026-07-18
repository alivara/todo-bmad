import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// AC5: the full Cream & Terracotta token set — light AND warm-dark values — must be
// defined as CSS variables from day one. This guards against a token silently going
// missing (which would break the theme system Epic 3 builds on).
// Resolved from cwd (the web/ dir when vitest runs) so it works under the jsdom env.
const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');

const LIGHT_TOKENS = [
  'surface-base',
  'surface-raised',
  'ink-primary',
  'ink-secondary',
  'ink-muted',
  'accent',
  'accent-soft',
  'border-hairline',
  'on-accent',
];

describe('design tokens (globals.css)', () => {
  it('defines every light token as a CSS variable', () => {
    for (const token of LIGHT_TOKENS) {
      expect(css).toContain(`--${token}:`);
    }
  });

  it('defines every warm-dark token as a CSS variable', () => {
    for (const token of LIGHT_TOKENS) {
      expect(css).toContain(`--${token}-dark:`);
    }
  });
});
