export type ReadVerdict = "ok" | "too-short" | "too-long";

/** Reads needed before the tracker will judge anything. */
const SEED_READS = 3;
/** How many recent reads the median is taken over, so a drifting pace is followed. */
const WINDOW = 8;

export const DURATION_SHORTFALL = 0.6;
export const DURATION_OVERRUN = 1.8;

export interface RateTracker {
  /** Median seconds per syllable, or null before the tracker is seeded. */
  readonly secondsPerSyllable: number | null;
  observe(syllables: number, seconds: number): void;
  judge(syllables: number, seconds: number): ReadVerdict;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

/**
 * Tracks how long Austen takes per syllable and judges each read against it.
 *
 * Median over a recent window rather than a mean over the session: one stumble
 * that ran four times long would drag a mean far enough to stop flagging real
 * failures, and the window is what lets the pace drift as he settles in.
 */
export function createRateTracker(): RateTracker {
  const rates: number[] = [];

  return {
    get secondsPerSyllable() {
      return rates.length >= SEED_READS ? median(rates) : null;
    },

    observe(syllables, seconds) {
      if (syllables <= 0 || !Number.isFinite(seconds) || seconds <= 0) return;
      rates.push(seconds / syllables);
      if (rates.length > WINDOW) rates.shift();
    },

    judge(syllables, seconds) {
      if (rates.length < SEED_READS || syllables <= 0) return "ok";
      const expected = median(rates) * syllables;
      if (seconds < expected * DURATION_SHORTFALL) return "too-short";
      if (seconds > expected * DURATION_OVERRUN) return "too-long";
      return "ok";
    },
  };
}
