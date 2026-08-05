/**
 * Action trail — a 200-entry ring buffer of what the ghost decided and whether
 * it landed (spec: 2026-08-04-ghost-mind-design.md §Two cheap taxes).
 *
 * Costs nothing and answers the only diagnostic question that matters when the
 * ghost stalls in front of strangers: which precondition lied? Entries with
 * `ok: false` are intentions that ran and found nothing to touch.
 */

export interface TrailEntry {
  /** ms since the trail was created. */
  t: number;
  intentionId: string;
  thought: string;
  moduleId: string | null;
  /** False when the perform found nothing to act on (a lying precondition). */
  ok: boolean;
}

export interface Trail {
  push: (entry: Omit<TrailEntry, "t">) => void;
  /** Oldest first. */
  entries: () => TrailEntry[];
  /** Count of failed performs — the stall signal. */
  failures: () => number;
  /**
   * `now()` when the last decision landed — the liveness clock the host's
   * watchdog reads. A trail that has not advanced in minutes is a ghost frozen
   * in front of strangers, which nothing else in the system would notice.
   */
  lastAt: () => number;
}

const CAPACITY = 200;

export function createTrail(now: () => number = () => performance.now()): Trail {
  const buffer: TrailEntry[] = [];
  const t0 = now();
  let lastAt = t0;

  return {
    push: (entry) => {
      lastAt = now();
      buffer.push({ ...entry, t: Math.round(lastAt - t0) });
      if (buffer.length > CAPACITY) buffer.shift();
    },
    entries: () => [...buffer],
    failures: () => buffer.filter((e) => !e.ok).length,
    lastAt: () => lastAt,
  };
}
