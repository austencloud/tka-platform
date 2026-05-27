/**
 * Bridge-free English words — every letter transition is direct.
 * Curated from the full enumeration in docs/reference/tka-valid-words.md.
 * Use these for examples, teaching, and documentation.
 */

/** Common recognizable bridge-free words, sorted by length descending */
export const BRIDGE_FREE_EXAMPLES: readonly string[] = [
  // 8 letters
  "SPONSORS", "SUPPORTS",
  // 7 letters
  "OUTPUTS", "SPONSOR", "SUPPORT", "TORONTO",
  // 6 letters
  "MOTORS", "MOUNTS", "OUTPUT", "PROMPT", "SPORTS", "TROOPS", "TRUSTS",
  // 5 letters
  "MOTOR", "MOUNT", "PORTS", "POSTS", "PROMO", "PUMPS", "ROOMS",
  "ROOTS", "SORTS", "SPORT", "SPOTS", "STOPS", "STORM", "TOURS",
  "TROUT", "TRUST", "TUMOR", "TURNS",
  // 4 letters
  "BACK", "BALD", "CAKE", "FAKE", "HELD", "HIGH", "IDLE", "MOON",
  "MONO", "MOSS", "MOST", "MUST", "NOON", "NORM", "NUTS", "ONTO",
  "OOPS", "POOR", "PORT", "POST", "POUR", "PUMP", "ROOM", "ROOT",
  "RUNS", "SOON", "SORT", "SOUP", "SPOT", "STOP", "TONS", "TOPS",
  "TOUR", "TURN", "UPON",
] as const;

/** Long bridge-free words — impressive demonstrations */
export const BRIDGE_FREE_LONG: readonly string[] = [
  "UNMONOTONOUS",   // 12
  "MONOSPOROUS",    // 11
  "MONOSTOMOUS",    // 11
  "NONTORTUOUS",    // 11
  "NONTUMOROUS",    // 11
  "UNMURMUROUS",    // 11
  "UNSUMPTUOUS",    // 11
  "MONOTONOUS",     // 10
  "NONSUPPORT",     // 10
  "MONSTROUS",      // 9
  "SUMPTUOUS",      // 9
  "TORTUROUS",      // 9
  "SURMOUNTS",      // 9
] as const;

/** Short punchy bridge-free words good for quick demos */
export const BRIDGE_FREE_SHORT: readonly string[] = [
  "STORM", "TRUST", "SPORT", "MOTOR", "TROUT", "MOUNT", "PROMPT",
  "MOON", "ROOM", "PUMP", "BACK", "FAKE", "SOUP", "NOON", "ROOT",
] as const;

/** Pick a random bridge-free example word */
export function randomBridgeFreeExample(): string {
  const pool = BRIDGE_FREE_EXAMPLES;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
