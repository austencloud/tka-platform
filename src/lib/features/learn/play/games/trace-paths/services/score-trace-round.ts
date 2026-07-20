/**
 * Scoring for a completed trace round.
 *
 * Two rules here are load-bearing and should not be "simplified" later:
 *
 * 1. COMPLETION IS A GATE, NOT A WEIGHT. If the player skipped part of the
 *    route, no amount of beautiful line-work anywhere else buys it back. A
 *    weighted average would let someone score well for tracing three quarters
 *    of a shape gorgeously, which is not the skill this game is about.
 *
 * 2. SPEED PAYS NOTHING. Elapsed time is carried through for diagnostics and
 *    for the player's own curiosity, and it contributes exactly zero points.
 *    A timed bonus would turn a control exercise into a race, and racing a
 *    fingertip along a curve teaches the wrong habit.
 *
 * The components come back separately as well as combined, because "you lost
 * points" is useless feedback and "your line was clean but your hands were
 * 300ms apart" is not.
 */

import type { TraceMetrics } from "../domain/trace-types";
import { TRACE_QUALITY_WEIGHTS } from "../domain/trace-config";

export interface TraceQualityWeights {
  readonly accuracy: number;
  readonly continuity: number;
  readonly synchrony: number;
}

export interface TraceScoringConfig {
  /** Points a flawless round is worth before quality scaling. */
  readonly basePoints: number;
  /** Coverage required to score at all. 1 = every checkpoint, in order. */
  readonly coverageGate: number;
  readonly weights: TraceQualityWeights;
}

export const DEFAULT_TRACE_SCORING_CONFIG: TraceScoringConfig = {
  basePoints: 100,
  // Every checkpoint, in order. Nothing partial gets through the gate.
  coverageGate: 1,
  // Retuned in trace-config, never here — that file owns the balance and
  // already trips at module load if the weights stop summing to 1.
  weights: TRACE_QUALITY_WEIGHTS,
};

export interface TraceRoundScore {
  readonly points: number;
  readonly coverage: number;
  readonly accuracy: number;
  readonly continuity: number;
  /** Null on a one-hand round — there is nothing to be in sync with. */
  readonly synchrony: number | null;
  readonly quality: number;
}

export function scoreTraceRound(
  metrics: TraceMetrics,
  config: TraceScoringConfig = DEFAULT_TRACE_SCORING_CONFIG
): TraceRoundScore {
  const { accuracy, continuity, synchrony } = config.weights;

  // One-hand rounds renormalize over the two components that still apply.
  // Without this a solo player would be silently capped at 85% forever, paying
  // a penalty for a dimension their round does not even have.
  const hasSynchrony = metrics.synchrony !== null;
  const activeWeight = hasSynchrony
    ? accuracy + continuity + synchrony
    : accuracy + continuity;

  const quality =
    activeWeight === 0
      ? 0
      : (accuracy * metrics.accuracy +
          continuity * metrics.continuity +
          (hasSynchrony ? synchrony * (metrics.synchrony ?? 0) : 0)) /
        activeWeight;

  const passed = metrics.coverage >= config.coverageGate;
  const points = passed ? Math.round(config.basePoints * quality) : 0;

  return {
    points,
    coverage: metrics.coverage,
    accuracy: metrics.accuracy,
    continuity: metrics.continuity,
    synchrony: metrics.synchrony,
    quality,
  };
}
