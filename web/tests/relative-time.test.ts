import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '@/lib/relativeTime';

// RD-1 relative-time buckets + boundaries (spec I/O matrix). A FIXED injected `now`
// keeps every case deterministic — no real clock, per the testing rules (AD-7).
const NOW = new Date('2026-07-18T12:00:00Z');

// Helper: an ISO createdAt `seconds` before NOW.
function ago(seconds: number): string {
  return new Date(NOW.getTime() - seconds * 1000).toISOString().replace('.000Z', 'Z');
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatRelativeTime', () => {
  describe('buckets (I/O matrix)', () => {
    it('just-now: 30s -> "just now"', () => {
      expect(formatRelativeTime(ago(30), NOW)).toBe('just now');
    });

    it('minutes: 5m -> "5m ago"', () => {
      expect(formatRelativeTime(ago(5 * MINUTE), NOW)).toBe('5m ago');
    });

    it('hours: 2h -> "2h ago"', () => {
      expect(formatRelativeTime(ago(2 * HOUR), NOW)).toBe('2h ago');
    });

    it('days: 3d -> "3d ago"', () => {
      expect(formatRelativeTime(ago(3 * DAY), NOW)).toBe('3d ago');
    });

    it('date (same year): 8d -> "MMM D" with no year', () => {
      // 2026-07-18 minus 8 days = 2026-07-10, same calendar year as NOW.
      expect(formatRelativeTime('2026-07-10T12:00:00Z', NOW)).toBe('Jul 10');
    });

    it('date (other year): renders "MMM D, YYYY"', () => {
      // A different calendar year than NOW (2026) → year suffix appears.
      expect(formatRelativeTime('2025-07-10T12:00:00Z', NOW)).toBe('Jul 10, 2025');
    });
  });

  describe('boundaries (I/O matrix)', () => {
    it('59s -> "just now" / 60s -> "1m ago"', () => {
      expect(formatRelativeTime(ago(59), NOW)).toBe('just now');
      expect(formatRelativeTime(ago(60), NOW)).toBe('1m ago');
    });

    it('59m -> "59m ago" / 60m -> "1h ago"', () => {
      expect(formatRelativeTime(ago(59 * MINUTE), NOW)).toBe('59m ago');
      expect(formatRelativeTime(ago(60 * MINUTE), NOW)).toBe('1h ago');
    });

    it('23h -> "23h ago" / 24h -> "1d ago"', () => {
      expect(formatRelativeTime(ago(23 * HOUR), NOW)).toBe('23h ago');
      expect(formatRelativeTime(ago(24 * HOUR), NOW)).toBe('1d ago');
    });

    it('6d -> "6d ago" / 7d -> absolute date', () => {
      expect(formatRelativeTime(ago(6 * DAY), NOW)).toBe('6d ago');
      // 7 days before 2026-07-18T12:00Z = 2026-07-11T12:00Z (same year) → "Jul 11".
      expect(formatRelativeTime(ago(7 * DAY), NOW)).toBe('Jul 11');
    });
  });

  it('defaults `now` to the current time when omitted (just-now for a fresh stamp)', () => {
    const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    expect(formatRelativeTime(nowIso)).toBe('just now');
  });

  describe('robustness (review findings F2/F6)', () => {
    it('returns "" for an empty or malformed createdAt (no "undefined NaN, NaN")', () => {
      expect(formatRelativeTime('', NOW)).toBe('');
      expect(formatRelativeTime('not-a-date', NOW)).toBe('');
    });

    it('clamps a future/clock-skewed stamp to "just now" (not a negative label)', () => {
      const future = new Date(NOW.getTime() + 5 * MINUTE * 1000).toISOString().replace('.000Z', 'Z');
      expect(formatRelativeTime(future, NOW)).toBe('just now');
      const farFuture = new Date(NOW.getTime() + 400 * DAY * 1000).toISOString().replace('.000Z', 'Z');
      expect(formatRelativeTime(farFuture, NOW)).toBe('just now');
    });
  });
});
