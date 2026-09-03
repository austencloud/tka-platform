/**
 * How a phase gets read without lying about it.
 *
 * Seeking a rig to a phase does not put it at that phase. The arm solver, the
 * stance smoothing, and the contact lock all keep moving for a while after the
 * seek, and reading during that window produces measurements of a body
 * mid-transition rather than a body holding the pose. This was not theoretical:
 * a sampler that read immediately after seeking reported a 21 mm clip and 57
 * degrees of grip axis error at phases 1.25 through 2.25, and none of it
 * reproduced once the rig was left alone.
 *
 * A matrix built on those readings is worse than no matrix, because it sends
 * someone to inspect a frame where nothing is wrong. So a reading here is
 * never one look. It is: seek, wait out the settle window, read, wait a beat,
 * read again, and accept the phase only when the two reads agree. The
 * disagreement between them is kept as the convergence metric, which is the
 * only direct evidence a run has that the solve reached a fixed point.
 *
 * The clock is injected so this policy is testable without waiting.
 */

import {
  deriveSweepPhaseSample,
  type SweepPhaseSample,
  type SweepReading,
} from "./sweep-sample";

export interface SweepSettlePolicy {
  /**
   * How long the rig is left alone after a seek before the first read. The
   * measured transients ran to roughly a second; 1500 ms is that with margin.
   */
  settleMs: number;
  /** Gap between the two confirmation reads. */
  confirmMs: number;
  /**
   * Grip separation disagreement, in millimetres, still counted as settled.
   * Above this the reading is retried rather than trusted.
   */
  agreementToleranceMm: number;
  /** Collision-depth disagreement, in millimetres, still counted as settled. */
  penetrationToleranceMm: number;
  /** Extra settle attempts before a phase is given up as unsettled. */
  maxRetries: number;
  /** Additional settle time added by each retry. */
  retryBackoffMs: number;
}

export const DEFAULT_SETTLE_POLICY: SweepSettlePolicy = {
  settleMs: 1500,
  confirmMs: 300,
  agreementToleranceMm: 3,
  penetrationToleranceMm: 2,
  maxRetries: 2,
  retryBackoffMs: 750,
};

/** Wall-clock cost of one accepted reading, for the pre-run cost estimate. */
export function secondsPerSettledSample(
  policy: SweepSettlePolicy = DEFAULT_SETTLE_POLICY
): number {
  return (policy.settleMs + policy.confirmMs) / 1000;
}

/**
 * The narrow live seam. Everything above this line is pure; everything below
 * it needs a rig, a canvas, and a GPU. A batch runner outside the browser only
 * has to satisfy these three methods.
 */
export interface SweepRig {
  /** Put the rig at this phase of the loaded sequence. */
  seek(phase: number): void | Promise<void>;
  /**
   * The most recent frame's diagnostics. Null while the rig has not produced
   * a frame yet — a skeleton still loading reports no arms, and grading that
   * as a body would invent a failure.
   */
  read(): SweepReading | null;
}

export type SweepWait = (ms: number) => Promise<void>;

export const realWait: SweepWait = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export type SettleFailure =
  | "no-frame"
  | "never-agreed"
  | "cancelled";

export type SettledPhaseOutcome =
  | { settled: true; sample: SweepPhaseSample; attempts: number }
  | { settled: false; reason: SettleFailure; attempts: number };

function agrees(
  first: SweepPhaseSample,
  policy: SweepSettlePolicy
): boolean {
  const spread = first.convergence.gripSeparationSpreadMm;
  if (spread !== null && spread > policy.agreementToleranceMm) return false;
  if (first.convergence.penetrationSpreadMm > policy.penetrationToleranceMm) {
    return false;
  }
  return first.convergence.kindsAgree;
}

export interface ReadSettledPhaseOptions {
  rig: SweepRig;
  phase: number;
  configuredPropLengthCm: number;
  policy?: SweepSettlePolicy;
  wait?: SweepWait;
  signal?: { aborted: boolean };
}

/**
 * Read one phase, or report honestly that it could not be read.
 *
 * A phase that never agrees is NOT graded as passing and is NOT graded as
 * failing. It comes back unsettled, and the configuration counts it — so a
 * cell that could not be measured says so instead of showing a colour it did
 * not earn.
 */
export async function readSettledPhase({
  rig,
  phase,
  configuredPropLengthCm,
  policy = DEFAULT_SETTLE_POLICY,
  wait = realWait,
  signal,
}: ReadSettledPhaseOptions): Promise<SettledPhaseOutcome> {
  let attempts = 0;
  let lastSample: SweepPhaseSample | null = null;

  for (let attempt = 0; attempt <= policy.maxRetries; attempt += 1) {
    attempts = attempt + 1;
    if (signal?.aborted) return { settled: false, reason: "cancelled", attempts };

    await rig.seek(phase);
    await wait(policy.settleMs + attempt * policy.retryBackoffMs);
    if (signal?.aborted) return { settled: false, reason: "cancelled", attempts };

    const first = rig.read();
    if (!first) continue;

    await wait(policy.confirmMs);
    if (signal?.aborted) return { settled: false, reason: "cancelled", attempts };

    const second = rig.read();
    if (!second) continue;

    const sample = deriveSweepPhaseSample(
      phase,
      first,
      second,
      configuredPropLengthCm
    );
    lastSample = sample;
    if (agrees(sample, policy)) return { settled: true, sample, attempts };
  }

  return {
    settled: false,
    reason: lastSample ? "never-agreed" : "no-frame",
    attempts,
  };
}
