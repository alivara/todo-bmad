// Client mirror of the server caps (AD-10). Counted in Unicode code points — see codePoints.
// Shared by AddInput, TodoRow, and CharCounter so the three capped fields agree on one source.
export const MAX_TITLE = 200;
export const MAX_DESCRIPTION = 2000;

// Count Unicode code points, matching Go's utf8.RuneCountInString on the server. The spread
// iterates by code point (surrogate pairs collapse to 1); `.length` would count UTF-16 units
// and disagree with the server on astral characters.
export function codePoints(s: string): number {
  return [...s].length;
}
