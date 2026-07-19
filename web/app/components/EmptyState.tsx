// The bare empty state (AC2, UX-DR15). Microcopy is LOCKED (UX-DR25) — do not
// reword. The polished accent-soft illustration is Epic 3 (Story 3.2); here it is a
// calm, centered prompt that is never a blank screen.
export function EmptyState() {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-6) var(--space-4)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'relative',
          width: 84,
          height: 84,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* The softened accent-soft ring sits behind the glyph (opacity ~0.5) so the field reads as a
            gentle wash while the accent check itself stays crisp. */}
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'var(--radius-full)',
            background: 'var(--accent-soft)',
            opacity: 0.5,
          }}
        />
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          style={{ position: 'relative' }}
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12.5l2.5 2.5L16 9.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.3, margin: 0, color: 'var(--ink-primary)' }}>
        Nothing here yet
      </h2>
      <p style={{ fontSize: 14, lineHeight: 1.45, margin: 0, color: 'var(--ink-secondary)' }}>
        Add your first task above — it&apos;ll show up right here.
      </p>
    </div>
  );
}
