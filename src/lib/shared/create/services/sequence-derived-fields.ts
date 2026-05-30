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
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { updateSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { deriveGridMode } from "$lib/shared/pictograph/grid/services/grid-mode-deriver";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";

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
  if (!blue || !red) return step;

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
      s.motions?.[MotionColor.BLUE] &&
      s.motions?.[MotionColor.RED]
  );
  const gridMode = firstReal?.gridMode ?? seq.gridMode;

  return updateSequenceData(seq, { steps, gridMode });
}
