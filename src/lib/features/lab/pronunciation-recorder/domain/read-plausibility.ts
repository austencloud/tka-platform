export type ReadVerdict = "ok" | "too-short" | "too-long";

/** Reads needed before the tracker will judge anything. */
const SEED_READS = 3;
/** How many recent reads the median is taken over, so a drifting pace is followed. */
const WINDOW = 8;

export const DURATION_SHORTFALL = 0.6;
export const DURATION_OVERRUN = 1.8;

/**
 * The floor no read clears, seeded or not.
 *
 * The tracker judges nothing until it has three reads to compare against, so
 * for the opening three anything the detector reported was accepted — a cough,
 * a chair, a cleared throat — and the word moved on as if it had been read.
 * That is the "it just advances regardless" complaint: the only sign a word had
 * been taken was the prompt changing, and it changed either way.
 *
 * 0.12 s per syllable sits below any real read. Conversational speech runs
 * 4–6 syllables a second (0.17–0.25 s each) and reading a short list faster
 * than 8 a second is not a thing a mouth does, so nothing he actually says can
 * trip this — only something that was never speech.
 */
export const MIN_SECONDS_PER_SYLLABLE = 0.12;

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
      if (syllables <= 0) return "ok";
      if (seconds < MIN_SECONDS_PER_SYLLABLE * syllables) return "too-short";
      if (rates.length < SEED_READS) return "ok";
      const expected = median(rates) * syllables;
      if (seconds < expected * DURATION_SHORTFALL) return "too-short";
      if (seconds > expected * DURATION_OVERRUN) return "too-long";
      return "ok";
    },
  };
}
