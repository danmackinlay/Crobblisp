/** Shared scalar helpers, split out so diet.js and blend.js can't cycle. */
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
