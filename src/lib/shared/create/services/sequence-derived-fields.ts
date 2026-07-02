/**
 * Sequence Derived-Field Reconciliation
 *
 * gridMode, startPosition and endPosition are pure functions of the two hand
 * locations. They are also stored on steps/motions and historically mutated
 * independently of the motions, so single-hand edits leave them stale and
 * corrupt. These helpers recompute them from the motions so stored copies are
 * never trusted — only recomputed. Letter is async and handled separately
 * (deriveSequenceLetters / recalculateLetterForBeat).
 */
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { updateSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { deriveGridMode } from "$lib/shared/pictograph/grid/services/grid-mode-deriver";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";
import { rotateMotion } from "./motion-transforms";

/**
 * Recompute gridMode + start/end positions from a step's motions.
 *
 * - Plain object spread (NOT createStepData — that factory drops gridMode).
 * - Positions are guarded: getGridPositionFromLocations throws on a corrupt
 *   location pair, in which case the prior value is kept (an in-flight/invalid
 *   intermediate must not crash the editor).
 * - Blank / single-hand steps pass through unchanged.
 */
export function reconcileStepDerived<T extends StepData>(step: T): T {
  if (!step || step.isBlank) return step;

  const blue = step.motions?.[MotionColor.BLUE];
  const red = step.motions?.[MotionColor.RED];
  // A hand that is "not really there" is an invisible placeholder under the
  // both-required Step shape — same pass-through as the old absent-hand skip
  // (deriving positions from a placeholder's default location would corrupt).
  if (!isVisibleMotion(blue) || !isVisibleMotion(red)) return step;

  const gridMode: GridMode = deriveGridMode(blue, red);

  let startPosition = step.startPosition ?? null;
  let endPosition = step.endPosition ?? null;
  try {
    startPosition = getGridPositionFromLocations(
      blue.startLocation,
      red.startLocation
    );
  } catch {
    /* keep prior — corrupt/intermediate location pair */
  }
  try {
    endPosition = getGridPositionFromLocations(
      blue.endLocation,
      red.endLocation
    );
  } catch {
    /* keep prior */
  }

  return {
    ...step,
    gridMode,
    startPosition,
    endPosition,
    motions: {
      ...step.motions,
      [MotionColor.BLUE]: { ...blue, gridMode },
      [MotionColor.RED]: { ...red, gridMode },
    },
  };
}

/**
 * Reconcile every step's derived fields and recompute the sequence-level
 * gridMode summary from the reconciled steps (a sequence's steps are normally
 * uniform; the per-step/per-motion gridMode is the authoritative copy).
 */
export function normalizeSequenceDerived(seq: SequenceData): SequenceData {
  const steps = seq.steps.map((s) => reconcileStepDerived(s));

  const firstReal = steps.find(
    (s) =>
      !s.isBlank &&
      isVisibleMotion(s.motions?.[MotionColor.BLUE]) &&
      isVisibleMotion(s.motions?.[MotionColor.RED])
  );
  const gridMode = firstReal?.gridMode ?? seq.gridMode;

  return updateSequenceData(seq, { steps, gridMode });
}

/** Minimal pose shape shared by StepData and StartPositionData for rotation.
 *  Motions stay partial here: StartPositionData is a pictograph-level pose. */
type RotatablePose = {
  motions?: Partial<Record<MotionColor, MotionData | undefined>>;
  isBlank?: boolean;
};

/** Rotate one pose's hand locations by `steps` × 45°, then reconcile its derived
 *  fields (positions + gridMode) from the rotated motions. */
function rotatePose<T extends RotatablePose>(pose: T, steps: number): T {
  if (pose.isBlank) return pose;
  const blue = pose.motions?.[MotionColor.BLUE];
  const red = pose.motions?.[MotionColor.RED];
  if (!blue && !red) return pose;
  const rotatedMotions = {
    ...pose.motions,
    ...(blue ? { [MotionColor.BLUE]: rotateMotion(blue, steps) } : {}),
    ...(red ? { [MotionColor.RED]: rotateMotion(red, steps) } : {}),
  };
  return reconcileStepDerived({
    ...pose,
    motions: rotatedMotions,
  } as unknown as StepData) as unknown as T;
}

/**
 * Rotate an entire sequence's geometry by `steps` × 45° (sign = direction: +1 CW,
 * −1 CCW) and reconcile derived fields. This is the sync box-mode transform —
 * letters are rotation-invariant so NO dataset lookup is needed, and gridMode
 * flips (diamond↔box on odd steps) via the reconciler. Pure; never mutates `seq`.
 */
export function rotateSequenceGeometry(seq: SequenceData, steps: number): SequenceData {
  if (steps === 0) return seq;

  const rotatedSteps = seq.steps.map((s) => rotatePose(s, steps));
  const startPosition = seq.startPosition
    ? rotatePose(seq.startPosition, steps)
    : seq.startPosition;
  const startingPosition = seq.startingPosition
    ? rotatePose(seq.startingPosition, steps)
    : seq.startingPosition;

  const firstReal = rotatedSteps.find(
    (s) =>
      !s.isBlank &&
      isVisibleMotion(s.motions?.[MotionColor.BLUE]) &&
      isVisibleMotion(s.motions?.[MotionColor.RED])
  );
  const gridMode = firstReal?.gridMode ?? startPosition?.gridMode ?? seq.gridMode;

  return updateSequenceData(seq, {
    steps: rotatedSteps,
    startPosition,
    startingPosition,
    gridMode,
  });
}
