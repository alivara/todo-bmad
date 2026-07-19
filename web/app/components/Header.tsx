import type { CSSProperties } from 'react';
import { Wordmark } from './Wordmark';
import { ThemeToggle } from './ThemeToggle';

/**
 * The app header (Story 3.4). Extracts the inline header from page.tsx: the wordmark on the left,
 * and a right-side group holding the theme toggle then a NON-interactive placeholder avatar.
 *
 * The avatar is a forward gesture only (no login/accounts) — a decorative, aria-hidden, non-focusable
 * <span> (never a button, nothing on tap), so the a11y tree stays clean. All colors come from the
 * existing tokens; dark is served purely by the CSS-variable seam.
 */
export function Header() {
  return (
    <header style={headerStyle}>
      <Wordmark />
      <div style={rightGroupStyle}>
        <ThemeToggle />
        <span className="avatar-placeholder" data-testid="avatar-placeholder" aria-hidden="true">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            focusable="false"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
          </svg>
        </span>
      </div>
    </header>
  );
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-5) 0',
};

const rightGroupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
};
