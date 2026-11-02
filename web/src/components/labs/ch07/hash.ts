/**
 * Deterministic 32-bit FNV-1a hash of a string. Good enough to spread
 * keys for the simulators and stable across renders (no Math.random).
 */
export function fnv(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
