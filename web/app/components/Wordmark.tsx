// The wordmark (UX-DR4): lowercase "todo" + a terracotta accent dot. No icon/lockup.
export function Wordmark() {
  return (
    <span
      style={{
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: '-0.02em',
        color: 'var(--ink-primary)',
      }}
    >
      todo
      <span aria-hidden="true" style={{ color: 'var(--accent)' }}>
        .
      </span>
    </span>
  );
}
