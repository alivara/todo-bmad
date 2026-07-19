import { test, expect, resetTodos } from '../support/fixtures';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

/**
 * Accessibility audit (WCAG 2.1 A + AA) via axe-core, run against the real app in a browser.
 * Scans the app's key visual states — populated list (active + completed + long description),
 * empty state, and the inline edit-in-place editor — and writes the full axe results to
 * _bmad-output/test-artifacts/a11y/ for the audit report.
 *
 * Assertion policy (Story 3.5): the suite is a HARD gate on ALL WCAG A/AA violations, INCLUDING
 * `color-contrast`. The contrast exclusion was dropped once the palette fix landed (--ink-secondary
 * #6b6252, --accent #b0512f, --accent-strong for the Add label, completed text rerouted to
 * --ink-secondary). All five scanned states — populated, empty, edit, loading, populated-dark —
 * must now be contrast-clean in both themes.
 */

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const OUT_DIR = '../_bmad-output/test-artifacts/a11y';

type Violation = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number];

function summarize(v: Violation) {
  return {
    id: v.id,
    impact: v.impact,
    help: v.help,
    wcag: v.tags.filter((t) => t.startsWith('wcag')),
    nodes: v.nodes.length,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
  };
}

function persist(state: string, violations: Violation[]) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/${state}.json`, JSON.stringify(violations.map(summarize), null, 2));
}

function assertNoViolations(state: string, violations: Violation[]) {
  persist(state, violations);
  // Surface everything in the run log for the report.
  console.log(`[a11y:${state}] total=${violations.length}`);
  for (const v of violations) console.log(`  - ${v.impact}\t${v.id}\t(${v.nodes.length})\t${v.help}`);
  expect(violations, `WCAG A/AA violations in "${state}": ${violations.map((v) => v.id).join(', ')}`).toEqual(
    [],
  );
}

test.describe('@a11y accessibility audit (WCAG 2.1 AA, axe-core)', () => {
  test.beforeEach(async ({ request }) => {
    await resetTodos(request);
  });

  test('a11y-001 populated list — active + completed + long-description rows', async ({ page, request }) => {
    await request.post('/api/todos', {
      data: {
        title: 'Review the Q3 report',
        description:
          'Cross-check the figures against last quarter and flag anything that moved more than ten percent so we can discuss it in the Monday sync.',
      },
    });
    const res = await request.post('/api/todos', { data: { title: 'Book the venue' } });
    const created = await res.json();
    await request.patch(`/api/todos/${created.id}`, { data: { status: 'completed' } });
    await request.post('/api/todos', { data: { title: 'Email Sam the numbers' } });

    await page.goto('/');
    await expect(page.getByRole('checkbox').first()).toBeVisible();
    await expect(page.getByText('Review the Q3 report')).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
    assertNoViolations('populated-list', violations);
  });

  test('a11y-005 populated list — warm-dark theme (Story 3.4)', async ({ page, request }) => {
    // Same populated shape as a11y-001, then stamp dark via the header toggle and re-scan. Guards
    // that activating the dark palette stays fully AA-clean — no structural/name/role/landmark AND
    // no color-contrast regression in the warm-dark theme (the gate now includes contrast).
    await request.post('/api/todos', {
      data: {
        title: 'Review the Q3 report',
        description:
          'Cross-check the figures against last quarter and flag anything that moved more than ten percent so we can discuss it in the Monday sync.',
      },
    });
    const res = await request.post('/api/todos', { data: { title: 'Book the venue' } });
    const created = await res.json();
    await request.patch(`/api/todos/${created.id}`, { data: { status: 'completed' } });
    await request.post('/api/todos', { data: { title: 'Email Sam the numbers' } });

    await page.goto('/');
    await expect(page.getByRole('checkbox').first()).toBeVisible();
    await page.getByRole('button', { name: /toggle theme/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // The card surface has a 350ms `background` transition; scanning mid-fade would read an
    // intermediate light-ish surface under the dark text (a transient, not a real violation).
    // Snap all transitions/animations to their settled value so axe audits the STABLE warm-dark
    // presentation — WCAG contrast is a property of the settled state.
    await page.addStyleTag({
      content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
    });

    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
    assertNoViolations('populated-dark', violations);
  });

  test('a11y-002 empty state', async ({ page }) => {
    await page.goto('/');
    // Empty-state copy renders once the (empty) list resolves.
    await expect(page.getByRole('checkbox')).toHaveCount(0);

    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
    assertNoViolations('empty-state', violations);
  });

  test('a11y-004 loading skeleton state', async ({ page }) => {
    // Hold the list GET open so the skeleton-shimmer loading state stays on screen for the scan
    // (network-first: route BEFORE goto). A gate promise keeps the request pending; released in
    // finally so teardown stays clean regardless of the assertion outcome.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/todos', async (route) => {
      if (route.request().method() === 'GET') {
        await gate; // keep pending → the skeleton (never a blank frame) stays visible
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      } else {
        await route.continue();
      }
    });

    try {
      await page.goto('/');
      // The skeleton's role="status" caption is on screen while the list request is in flight.
      await expect(page.getByText('Getting your tasks…')).toBeVisible();

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
      assertNoViolations('loading-skeleton', violations);

      // Release inside the test window and let the skeleton resolve to content (the held GET
      // returns []), so route.fulfill completes before teardown (no "Target closed" race noise).
      release();
      await expect(page.getByText('Nothing here yet')).toBeVisible();
    } finally {
      release(); // idempotent safety if an assertion above threw before the release
    }
  });

  test('a11y-003 inline edit-in-place editor open', async ({ page, request }) => {
    await request.post('/api/todos', {
      data: { title: 'Edit me for a11y', description: 'a description to edit' },
    });

    await page.goto('/');
    // Enter edit mode by activating the title (row becomes the editor).
    await page.getByText('Edit me for a11y').click();
    await expect(page.getByRole('textbox', { name: /edit title/i })).toBeVisible();

    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
    assertNoViolations('edit-editor', violations);
  });
});
