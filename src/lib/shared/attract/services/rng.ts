/**
 * Seeded RNG for the ghost mind (spec: 2026-08-04-ghost-mind-design.md §Two
 * cheap taxes). Every decision the mind makes routes through here, so a tour
 * is reproducible from its logged seed. Two lines now, impossible to retrofit
 * once a hundred call sites have reached for Math.random().
 *
 * The attract-ghost core keeps its own bare Math.random() for motor jitter —
 * that noise is cosmetic and does not affect which intentions get chosen.
 */

export interface Rng {
  /** The seed this generator was created with (log it, replay with it). */
  readonly seed: number;
  /** Uniform in [0, 1). */
  next: () => number;
  /** Integer in [0, n). */
  int: (n: number) => number;
  /** A uniformly-chosen element. Undefined only for an empty array. */
  pick: <T>(arr: readonly T[]) => T | undefined;
  /** An element chosen with probability proportional to its weight. */
  weighted: <T>(arr: readonly T[], weight: (item: T) => number) => T | undefined;
}

/** mulberry32 — small, fast, and good enough for choosing what to look at. */
export function createRng(seed: number = Math.floor(Math.random() * 2 ** 32)): Rng {
  let a = seed >>> 0;

  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (n: number) => Math.floor(next() * n);

  return {
    seed,
    next,
    int,
    pick: <T>(arr: readonly T[]) => (arr.length ? arr[int(arr.length)] : undefined),
    weighted: <T>(arr: readonly T[], weight: (item: T) => number) => {
      if (!arr.length) return undefined;
      const weights = arr.map((item) => Math.max(0, weight(item)));
      const total = weights.reduce((sum, w) => sum + w, 0);
      // All-zero weights degrade to a uniform pick rather than always the
      // first element — a silent argmax is exactly the failure this avoids.
      if (total <= 0) return arr[int(arr.length)];
      let roll = next() * total;
      for (let i = 0; i < arr.length; i++) {
        roll -= weights[i]!;
        if (roll <= 0) return arr[i];
      }
      return arr[arr.length - 1];
    },
  };
}
