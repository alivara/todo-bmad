import { describe, expect, it } from 'vitest';
import { MAX_TITLE, MAX_DESCRIPTION, codePoints } from '@/lib/caps';

// The shared cap constants + the code-point counter (AD-10). codePoints must match Go's
// utf8.RuneCountInString: count Unicode code points, NOT UTF-16 units and NOT grapheme clusters.
describe('caps', () => {
  it('exposes the server-mirrored cap values', () => {
    expect(MAX_TITLE).toBe(200);
    expect(MAX_DESCRIPTION).toBe(2000);
  });

  it('counts plain ASCII by code point', () => {
    expect(codePoints('')).toBe(0);
    expect(codePoints('hello')).toBe(5);
  });

  it('counts an astral emoji as one code point, not two UTF-16 units', () => {
    // '😀' is a surrogate pair (2 UTF-16 units); .length would say 2.
    expect('😀'.length).toBe(2);
    expect(codePoints('😀')).toBe(1);
    expect(codePoints('😀'.repeat(200))).toBe(200);
  });

  it('counts a ZWJ family emoji as its constituent code points (5), not one grapheme', () => {
    const family = String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467);
    expect(codePoints(family)).toBe(5);
  });
});
