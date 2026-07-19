'use client';

// Route-level React error boundary (AR14). It is the backstop so no unhandled render
// error reaches the user as a blank screen or raw stack. The polished, systematized
// error handling lands in Epic 3; this is the minimal safety net for Story 1.1.
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
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
        className="focus-ring"
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
  );
}
