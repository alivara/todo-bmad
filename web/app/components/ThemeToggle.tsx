'use client';

/**
 * The header theme toggle (Story 3.4). A real, icon-only <button> whose sun/moon glyphs are
 * CSS-toggled by `:root[data-theme='dark']` (both SVGs are rendered; globals.css shows one) — so
 * there is NO React theme state and NO hydration mismatch (no theme-dependent render, no `mounted`
 * flag). The DOM attribute on <html> is the source of truth: onClick reads it, flips it, and writes
 * the choice to localStorage. The static aria-label keeps the accessible name stable across themes.
 */
export function ThemeToggle() {
  function toggle() {
    const cur = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('todo-theme', next);
    } catch {
      // Storage can throw (private mode / disabled). The in-session theme still applies; the
      // choice simply won't persist — never blocks the toggle.
    }
  }

  return (
    <button type="button" className="theme-toggle" aria-label="Toggle theme" onClick={toggle}>
      {/* Sun — shown in light (default). */}
      <svg
        className="icon-sun"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
      {/* Moon — shown in dark. */}
      <svg
        className="icon-moon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
      </svg>
    </button>
  );
}
