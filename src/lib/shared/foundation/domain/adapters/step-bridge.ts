/**
 * Step Bridge — transitional adapters between the app's `StepData`/`MotionData`
 * and the canonical `@tka/tka-types` `Step`/`Motion`.
 *
 * Used during sub-migration A (sequence-engine unification Phase 2 — see
 * docs/superpowers/specs/active/2026-06-30-stepdata-step-migration-scope.md) so
 * a module converted to `Step` can still bridge to neighbors that still speak
 * `StepData`. Deleted once `StepData` is gone.
 *
 * Conversion is lossy by design: `Motion` is the lean structural type, so the
 * render data embedded on `MotionData` (arrowPlacementData, propPlacementData,
 * propType, isVisible, arrowLocation, gridMode, skewSteps, pathShape) is
 * dropped — it is recomputed downstream by the render pipeline, never authored
 * on the step. Stored reversal flags and `isSelected` are likewise dropped:
 * reversals derive via `deriveReversals(steps)`, selection lives in
 * `selection-store.svelte.ts`.
 */
import { createMotion, createStep, type Motion, type Step } from "@tka/tka-types";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/** Project an app `MotionData` onto the lean structural `Motion`. */
export function motionDataToMotion(md: MotionData): Motion {
  return createMotion({
    motionType: md.motionType,
    startLocation: md.startLocation,
    endLocation: md.endLocation,
    rotationDirection: md.rotationDirection,
    startOrientation: md.startOrientation,
    endOrientation: md.endOrientation,
    turns: md.turns,
    ...(md.plane !== undefined && { plane: md.plane }),
    ...(md.color !== undefined && { color: md.color }),
    ...(md.prefloatMotionType !== undefined && {
      prefloatMotionType: md.prefloatMotionType,
    }),
    ...(md.prefloatRotationDirection !== undefined && {
      prefloatRotationDirection: md.prefloatRotationDirection,
    }),
  });
}

/**
 * Convert an app `StepData` to a canonical `Step`. Both hand motions must be
 * present — a `Step` cannot hold a partial motions record. Throws with the
 * offending step's id/number when a motion is missing, so callers fail loud
 * instead of silently producing an invalid step.
 */
export function stepDataToStep(sd: StepData): Step {
  const blue = sd.motions[MotionColor.BLUE];
  const red = sd.motions[MotionColor.RED];
  if (!blue || !red) {
    throw new Error(
      `stepDataToStep: step ${sd.stepNumber} (${sd.id}) is missing its ${!blue ? "blue" : "red"} motion`
    );
  }
  return createStep({
    id: sd.id,
    letter: sd.letter ?? null,
    startPosition: sd.startPosition ?? null,
    endPosition: sd.endPosition ?? null,
    motions: { blue: motionDataToMotion(blue), red: motionDataToMotion(red) },
    ...(sd.gridMode !== undefined && { gridMode: sd.gridMode }),
    stepNumber: sd.stepNumber,
    duration: sd.duration,
    ...(sd.isBlank !== undefined && { isBlank: sd.isBlank }),
  });
}
