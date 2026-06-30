/**
 * Step Bridge — transitional adapters between the app's `StepData`/`MotionData`
 * and the canonical `@tka/tka-types` `Step`/`Motion`.
 *
 * Used during sub-migration A (sequence-engine unification Phase 2 — see
 * docs/superpowers/specs/active/2026-06-30-stepdata-step-migration-scope.md) so
 * a module converted to `Step` can still bridge to neighbors that still speak
 * `StepData`. Deleted once `StepData` is gone.
 *
 * Conversion is lossy: `Motion` is lean structural-only, so the render data
 * embedded on `MotionData` is dropped on the forward pass and rebuilt as
 * `createMotionData` defaults on the reverse pass.
 *
 * ⚠ CRITICAL: that render data is NOT all "recomputed downstream." Some of it is
 * USER-AUTHORED and PERSISTED: `pathShape`, `skewSteps`/`skewDir`,
 * `arrowPlacementData.manualAdjustmentX/Y` (manual arrow nudges), `isVisible`
 * (hidden-prop toggles), and effective `propType`. A `Step → StepData`
 * round-trip via `stepToStepData` SILENTLY DISCARDS those authored choices.
 * Therefore `stepToStepData` must NEVER run on a path that renders, persists,
 * or re-authors a step (the render pipeline, serialization/identity hashing,
 * the step-operation arrow/prop/path-shape/beta handlers) until the
 * authored-vs-derived split is formalized — that is migration B.
 *
 * Stored reversal flags are also dropped and left `false`; the existing reversal
 * pipeline (`reversalDetector.processReversals`) refills them. Do NOT substitute
 * the engine `deriveReversals` for display flags — `processReversals` has
 * loop-wrap semantics the engine version lacks. `isSelected` moves to
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
 * Rebuild an app `MotionData` from a lean `Motion`. The render fields a `Motion`
 * doesn't carry are filled with `createMotionData` defaults. Some of those
 * fields are derived (recomputed by the render pipeline) but others are
 * USER-AUTHORED and PERSISTED (pathShape, skew, manual arrow nudges, isVisible,
 * effective propType) — those authored values are LOST here. See the file
 * header: never round-trip a step through this on a render/persist/author path.
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
 *
 * ⚠ LOSSY for authored choreographic data (see file header) — do NOT use on a
 * render, persistence/hashing, or step-authoring path. Migration-A callers use
 * the FORWARD direction (stepDataToStep) on structural reads only.
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
