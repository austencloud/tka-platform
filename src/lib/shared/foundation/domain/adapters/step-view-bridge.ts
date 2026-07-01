/**
 * Lossless Step + MotionView bridge — the canonical-representation keystone for
 * the StepData->Step migration.
 *
 * The generic `stepToStepData` / `motionToMotionData` (step-bridge.ts) are LOSSY:
 * canonical lean `Motion` has no slot for the authored view fields (handPath,
 * skew, pathShape, isVisible, propType, arrowLocation, gridMode, placements), so
 * a round-trip through them nulls those fields. That silently shifts the V2
 * identity contentHash (which reads handPath/skew — sequence-content-hasher.ts:
 * 172,175,176) and re-keys the soloprop/path dedup hashes — a phantom-fork the
 * pixel net cannot see.
 *
 * This bridge pairs a lean canonical `Step` with a per-hand `MotionView`
 * side-channel that carries EVERY view field, so `StepData -> StepWithView ->
 * StepData` is byte-identical on every fingerprint. Proven over the corpus by
 * scripts/migrations/step-roundtrip-parity.ts (0 drift). It is the minimal wedge
 * of "migration B" (MotionData -> Motion & MotionView) done losslessly for the
 * whole-step boundary, and the safe adapter the real hydrate-seam flip must use.
 */
import type { Motion, Step } from "@tka/tka-types";
import { createMotionData, type MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { MotionView } from "$lib/shared/pictograph/shared/domain/models/motion-view";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { stepDataToStep, motionToMotionData } from "./step-bridge";

/** A canonical `Step` paired with the per-hand view fields lean `Motion` drops. */
export interface StepWithView {
  readonly step: Step;
  readonly view: { readonly blue: MotionView; readonly red: MotionView };
}

/** Extract the view-layer fields off a fat `MotionData` into a `MotionView`. */
export function motionDataToMotionView(md: MotionData): MotionView {
  return {
    isVisible: md.isVisible,
    propType: md.propType,
    arrowLocation: md.arrowLocation,
    gridMode: md.gridMode,
    arrowPlacementData: md.arrowPlacementData,
    propPlacementData: md.propPlacementData,
    handPath: md.handPath ?? null,
    skewSteps: md.skewSteps ?? null,
    skewDir: md.skewDir ?? null,
    pathShape: md.pathShape,
  };
}

/** Rebuild a fat `MotionData` losslessly from a lean `Motion` + its `MotionView`. */
export function motionWithViewToMotionData(m: Motion, view: MotionView, color: MotionColor): MotionData {
  return createMotionData({
    ...motionToMotionData(m, color), // structural fields (motionType, locations, orientations, turns, plane, prefloat)
    ...(view.isVisible !== undefined && { isVisible: view.isVisible }),
    ...(view.propType !== undefined && { propType: view.propType }),
    ...(view.arrowLocation !== undefined && { arrowLocation: view.arrowLocation }),
    ...(view.gridMode !== undefined && { gridMode: view.gridMode }),
    ...(view.arrowPlacementData !== undefined && { arrowPlacementData: view.arrowPlacementData }),
    ...(view.propPlacementData !== undefined && { propPlacementData: view.propPlacementData }),
    handPath: view.handPath ?? null,
    skewSteps: view.skewSteps ?? null,
    skewDir: view.skewDir ?? null,
    pathShape: view.pathShape,
  });
}

/** Forward: `StepData` -> canonical `Step` + the per-hand view side-channel. */
export function stepDataToStepWithView(sd: StepData): StepWithView {
  const blue = sd.motions[MotionColor.BLUE];
  const red = sd.motions[MotionColor.RED];
  if (!blue || !red) {
    throw new Error(`stepDataToStepWithView: step ${sd.stepNumber} (${sd.id}) is missing a motion`);
  }
  return {
    step: stepDataToStep(sd),
    view: { blue: motionDataToMotionView(blue), red: motionDataToMotionView(red) },
  };
}

/**
 * Reverse: canonical `Step` + view side-channel -> `StepData`, LOSSLESS on the
 * motion fields every fingerprint reads. Reversal flags default to false (the
 * hydrate pipeline's processReversals refills them, exactly as the app does
 * today) and the V2 identity hash excludes them anyway.
 */
export function stepWithViewToStepData({ step, view }: StepWithView): StepData {
  return createStepData({
    id: step.id,
    letter: (step.letter ?? undefined) as StepData["letter"],
    startPosition: step.startPosition ?? undefined,
    endPosition: step.endPosition ?? undefined,
    stepNumber: step.stepNumber,
    duration: step.duration,
    ...(step.gridMode !== undefined && { gridMode: step.gridMode as StepData["gridMode"] }),
    ...(step.isBlank !== undefined && { isBlank: step.isBlank }),
    motions: {
      [MotionColor.BLUE]: motionWithViewToMotionData(step.motions.blue, view.blue, MotionColor.BLUE),
      [MotionColor.RED]: motionWithViewToMotionData(step.motions.red, view.red, MotionColor.RED),
    },
  });
}
