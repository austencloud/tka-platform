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
import {
  createMotionData,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import {
  MotionColor,
  type MotionType as AppMotionType,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { Letter as AppLetter } from "$lib/shared/foundation/domain/models/letter";

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

/**
 * Rebuild an app `MotionData` from a lean `Motion`. The render fields a
 * `Motion` doesn't carry (arrowPlacementData, propPlacementData, propType,
 * isVisible, arrowLocation, gridMode) are filled with `createMotionData`
 * defaults and recomputed downstream by the render pipeline — they are derived,
 * never authored on the step.
 */
export function motionToMotionData(m: Motion, color: MotionColor): MotionData {
  return createMotionData({
    // tka-types Motion.motionType is broader (it also includes "shift", which the
    // app models separately as HandMotionType). A real app step motion is never
    // "shift", so narrowing is safe here; the engine/app shift conflation is a
    // deferred reconciliation for migration B.
    motionType: m.motionType as AppMotionType,
    startLocation: m.startLocation,
    endLocation: m.endLocation,
    rotationDirection: m.rotationDirection,
    startOrientation: m.startOrientation,
    endOrientation: m.endOrientation,
    turns: m.turns,
    color,
    ...(m.plane !== undefined && { plane: m.plane }),
    ...(m.prefloatMotionType !== undefined && {
      prefloatMotionType: m.prefloatMotionType as AppMotionType,
    }),
    ...(m.prefloatRotationDirection !== undefined && {
      prefloatRotationDirection: m.prefloatRotationDirection,
    }),
  });
}

/**
 * Rebuild an app `StepData` from a canonical `Step`, so a `Step`-speaking
 * module can hand a value back to a neighbor that still speaks `StepData`.
 *
 * Reversal flags default to `false` — they are filled later by the existing
 * reversal pipeline (`reversalDetector.processReversals`), exactly as today, so
 * this adapter introduces no reversal-logic change (the loop-wrap behavior the
 * app's detector has but the engine's `deriveReversals` lacks is preserved).
 * Selection is not restored here; it lives in the selection store.
 */
export function stepToStepData(step: Step): StepData {
  return createStepData({
    id: step.id,
    // App `Letter` is a nominal string enum; tka-types `Letter` is an identical
    // `as const` string union (same 47 members). Pure nominal divergence — cast.
    letter: step.letter as AppLetter | null,
    startPosition: step.startPosition,
    endPosition: step.endPosition,
    motions: {
      [MotionColor.BLUE]: motionToMotionData(step.motions.blue, MotionColor.BLUE),
      [MotionColor.RED]: motionToMotionData(step.motions.red, MotionColor.RED),
    },
    ...(step.gridMode !== undefined && { gridMode: step.gridMode }),
    stepNumber: step.stepNumber,
    duration: step.duration,
    isBlank: step.isBlank ?? false,
  });
}
