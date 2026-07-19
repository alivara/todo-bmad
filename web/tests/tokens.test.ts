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

  // Story 3.4 dark-seam guard: the theme toggle relies on the :root[data-theme='dark'] block
  // remapping every base token to its -dark value. This pins that the seam stays wired (a
  // regression that unmaps a token would leave the toggle stamping dark but half the palette light).
  it("wires the :root[data-theme='dark'] seam to remap every base token to its -dark value", () => {
    const match = css.match(/:root\[data-theme='dark'\]\s*\{([^}]*)\}/);
    expect(match, "missing the :root[data-theme='dark'] seam").not.toBeNull();
    const darkBlock = match![1];
    for (const token of LIGHT_TOKENS) {
      expect(darkBlock).toContain(`--${token}: var(--${token}-dark)`);
    }
  });
});
