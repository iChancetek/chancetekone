/**
 * Deterministic, synchronous, dependency-free hashing.
 *
 * These hashes are used ONLY for stable identifiers (idempotent re-processing,
 * resume-after-interruption, artwork asset de-duplication). Audio integrity
 * checksums remain SHA-256 (see id3Parser.computeSHA256).
 */

/** 53-bit cyrb53 hash rendered as a base-36 string. */
export function stableHash(input: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Normalizes free text for comparison: lower-case, strip diacritics and
 * punctuation, collapse whitespace.
 */
export function normalizeKey(value: string | undefined | null): string {
  if (!value) return '';
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
