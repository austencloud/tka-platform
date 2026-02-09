/**
 * Term aliases for fuzzy search.
 * Maps alternate spellings, abbreviations, and common variations
 * to their canonical glossary term.
 */
export const TERM_ALIASES: Record<string, string> = {
  "counter-clockwise": "counterclockwise",
  "counter clockwise": "counterclockwise",
  "prospin": "prospin",
  "antispin": "antispin",
  "pro-spin": "prospin",
  "anti-spin": "antispin",
  "type 1": "dual-shift",
  "type1": "dual-shift",
  "type 2": "shift",
  "type2": "shift",
  "type 3": "cross-shift",
  "type3": "cross-shift",
  "type 4": "dash",
  "type4": "dash",
  "type 5": "dual-dash",
  "type5": "dual-dash",
  "type 6": "static",
  "type6": "static",
  "tog-same": "together-same",
  "tog same": "together-same",
  "ts": "together-same",
  "split-opp": "split-opposite",
  "split opp": "split-opposite",
  "so": "split-opposite",
  "tog-opp": "together-opposite",
  "tog opp": "together-opposite",
  "to": "together-opposite",
  "ss": "split-same",
  "hand reversal": "hand-reversal",
  "prop reversal": "prop-reversal",
  "full reversal": "full-reversal",
  "motion type": "shift",
  "grid mode": "diamond",
  "half-dash": "hash",
  "half dash": "hash",
  "base rotation": "base-rotation",
  "interradials": "interradial",
  "conjoined": "conjoined-grid",
  "conjoined grid": "conjoined-grid",
  "rubik's cube": "rubiks-cube",
  "rubiks cube": "rubiks-cube",
} as const;

/** Resolve a term through the alias map. Returns the canonical term. */
export function resolveTermAlias(term: string): string {
  const normalized = term.toLowerCase().trim();
  return TERM_ALIASES[normalized] ?? normalized;
}
