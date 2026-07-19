// Pure RD-1 relative-time formatter. The client never generates timestamps (AD-7);
// this is a pure function of the server-issued `createdAt`, with `now` injected for
// testability (default `new Date()`). Buckets are binding (resolved-decisions RD-1):
//   <60s   -> "just now"
//   <60m   -> "Nm ago"
//   <24h   -> "Nh ago"
//   <7d    -> "Nd ago"
//   >=7d   -> absolute "MMM D" (adds ", YYYY" only when a different calendar year).
//
// `createdAt` is RFC3339 UTC ("…Z", second precision). The absolute date is rendered
// from UTC parts so the label is deterministic regardless of the runtime's timezone,
// and the year-boundary check compares UTC years.

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function formatRelativeTime(createdAt: string, now: Date = new Date()): string {
  const created = new Date(createdAt);
  // Defensive: `createdAt` is server-authoritative RFC3339, but a pure formatter must not
  // emit "undefined NaN, NaN" if ever handed a malformed value — return an empty label.
  if (Number.isNaN(created.getTime())) return '';
  // Clamp a future/clock-skewed stamp (second-precision + skew makes a slightly-ahead
  // server time realistic) to 0 → "just now" is the intentional, graceful outcome.
  const seconds = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 1000));

  if (seconds < MINUTE) return 'just now';
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)}m ago`;
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)}h ago`;
  if (seconds < WEEK) return `${Math.floor(seconds / DAY)}d ago`;

  const month = MONTHS_SHORT[created.getUTCMonth()];
  const day = created.getUTCDate();
  const createdYear = created.getUTCFullYear();
  if (createdYear !== now.getUTCFullYear()) {
    return `${month} ${day}, ${createdYear}`;
  }
  return `${month} ${day}`;
}
