'use client';

import './globals.css';

// The ROOT error boundary (AC4b / AD-14). `app/error.tsx` catches render throws within the page,
// but a throw in the root layout itself escapes it — global-error is the last backstop, so even a
// root-layout failure shows the warm locked copy instead of a white screen. It replaces the root
// layout when it renders, so it must supply its own <html>/<body>. Same locked microcopy as
// error.tsx (voice rule: reassure before explain — no status codes / jargon / alarm-red).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <div
          role="alert"
          style={{
            maxWidth: 560,
            margin: '0 auto',
            padding: 'var(--space-6) 18px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-3)',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink-primary)', margin: 0 }}>
            Couldn&apos;t load your tasks
          </p>
          <p style={{ fontSize: 14, color: 'var(--ink-secondary)', margin: 0 }}>
            Something got in the way. Your tasks are safe — let&apos;s try that again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '10px 18px',
              fontFamily: 'var(--font-sans)',
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
