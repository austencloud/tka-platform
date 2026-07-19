/**
 * Loop Explorer — Relation Extraction
 *
 * Exposes the engine's canonical pair-relation algebra
 * (`@tka/sequence-engine/loop` → `relationsForPair`) as
 * `{ beatA, beatB, transform }[]` for a generated sequence, so the
 * explanation pane can cite concrete beat pairs ("beat 9 = beat 1 rotated
 * 180°") without re-deriving the transform algebra app-side. Same detector
 * `LOOPDetector` (`shared/create/services/loop-detector.ts`) delegates to for
 * whole-sequence classification — this module surfaces its PER-PAIR
 * evidence instead of just the aggregate verdict.
 */

import type { StepLike } from "$lib/shared/foundation/domain/models/step-like";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { relationsForPair } from "@tka/sequence-engine/loop";
import type { PairComponentId, PairMotion, PairMotions, PairRelation, RotationAngle } from "@tka/sequence-engine/loop";
import type { LoopSlice } from "$lib/shared/loop-explorer/domain/legality";

export interface BeatPairRelation {
  /** 1-based beat index (first occurrence). */
  readonly beatA: number;
  /** 1-based beat index (the beat that restates beatA transformed). */
  readonly beatB: number;
  /** Sorted primitive ids; empty array means beatB literally repeats beatA. */
  readonly transform: readonly PairComponentId[];
  /** Present when the transform includes a rotation. */
  readonly rotation?: RotationAngle;
}

/** Interval (in beats) between a citation pair, given the sequence length + slice. */
export function defaultInterval(totalSteps: number, slice: LoopSlice): number {
  if (totalSteps < 2) return 0;
  return slice === "quartered" ? Math.floor(totalSteps / 4) : Math.floor(totalSteps / 2);
}

/**
 * Extract per-beat-pair relation citations at the given interval.
 * Pairs (i, i+interval) for i in [0, interval) — the same window
 * `uniformRelationAtInterval` scans for the aggregate verdict, surfaced here
 * per-pair for citation text. Ambiguous pairs (multiple hypotheses tie) are
 * resolved with the same simplest-explanation priority the engine detector
 * uses: fewest components, then no-invert, then no-swap.
 */
export function extractPairRelations(
  steps: readonly StepLike[],
  interval: number
): BeatPairRelation[] {
  if (interval <= 0 || interval >= steps.length) return [];

  const motions = steps.map(toPairMotions);
  const relations: BeatPairRelation[] = [];

  for (let i = 0; i + interval < steps.length; i++) {
    const a = motions[i];
    const b = motions[i + interval];
    if (!a || !b) continue;

    const candidates = relationsForPair(a, b);
    const best = pickSimplest(candidates);
    relations.push({
      beatA: i + 1,
      beatB: i + interval + 1,
      transform: best?.components ?? [],
      rotation: best?.rotation,
    });
  }

  return relations;
}

/** Simplest-explanation tie-break: fewest components, then no-invert, then no-swap. */
function pickSimplest(candidates: readonly PairRelation[]): PairRelation | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((x, y) => {
    if (x.priority !== y.priority) return x.priority - y.priority;
    const xi = x.components.includes("inverted") ? 1 : 0;
    const yi = y.components.includes("inverted") ? 1 : 0;
    if (xi !== yi) return xi - yi;
    const xs = x.components.includes("swapped") ? 1 : 0;
    const ys = y.components.includes("swapped") ? 1 : 0;
    return xs - ys;
  });
  return sorted[0] ?? null;
}

function toPairMotion(motion: StepLike["motions"]["blue"]): PairMotion {
  if (!motion || !isVisibleMotion(motion)) {
    return { startLocation: "", endLocation: "", motionType: "" };
  }
  return {
    startLocation: String(motion.startLocation ?? ""),
    endLocation: String(motion.endLocation ?? ""),
    motionType: String(motion.motionType ?? ""),
  };
}

function toPairMotions(step: StepLike): PairMotions {
  return {
    blue: toPairMotion(step.motions?.blue),
    red: toPairMotion(step.motions?.red),
  };
}
