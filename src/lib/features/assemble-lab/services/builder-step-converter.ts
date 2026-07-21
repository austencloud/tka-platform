/**
 * Builder Step Converter
 *
 * Converts visual builder's BuilderStep model into PictographData/MotionData.
 * Shared conversion boundary for Assemble's builder and sequence document.
 */

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
  HandMotionType,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { Letter } from "$lib/shared/foundation/domain/models/letter";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  calculateHandPath,
  calculateMotionType,
  calculateRotationDirection,
} from "$lib/features/create/assemble/services/hand-path-motion-calculator";
import { motionQueryHandler } from "$lib/shared/pictograph/shared/services/motion-query-handler";
import { arrowLocationCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/arrow-location-calculator";
import type {
  BuilderStartPose,
  BuilderStep,
} from "../state/assemble-state.svelte";

/** Derive MotionType (PRO/ANTI/DASH/STATIC) from step data */
export function resolveMotionType(
  step: BuilderStep,
  gridMode: GridMode
): MotionType {
  const handMotionType = calculateMotionType(
    step.startPosition,
    step.endPosition,
    gridMode
  );
  switch (handMotionType) {
    case HandMotionType.STATIC:
      return MotionType.STATIC;
    case HandMotionType.DASH:
      return MotionType.DASH;
    // Hash motions use the same rotation behavior as dash (straight line, no arc)
    case HandMotionType.HASH_IN:
    case HandMotionType.HASH_OUT:
      return MotionType.DASH;
    case HandMotionType.SHIFT: {
      // Float: -0.5 turns cancels the arc rotation so the prop appears to float
      if (step.turnCount === -0.5) return MotionType.FLOAT;

      const handPathDir = calculateRotationDirection(
        step.startPosition,
        step.endPosition,
        gridMode
      );
      return handPathDir === step.rotationDirection
        ? MotionType.PRO
        : MotionType.ANTI;
    }
    default:
      return MotionType.STATIC;
  }
}

export interface BuilderHydration {
  readonly blueSteps: BuilderStep[];
  readonly redSteps: BuilderStep[];
  readonly gridMode: GridMode;
  readonly startPoses: Partial<Record<MotionColor, BuilderStartPose>>;
}

/** Recover the builder's editable motion fields without dropping sequence-only metadata. */
export function motionToBuilderStep(motion: MotionData): BuilderStep {
  return {
    startPosition: motion.startLocation,
    endPosition: motion.endLocation,
    rotationDirection: motion.rotationDirection,
    turnCount: motion.turns === "fl" ? -0.5 : motion.turns,
    startOrientation: motion.startOrientation,
    endOrientation: motion.endOrientation,
  };
}

/**
 * Rebuild the per-hand builder model from the editable sequence document.
 * Invisible placeholder motions remain absent from the corresponding hand.
 */
export function sequenceToBuilderHydration(
  sequence: SequenceData
): BuilderHydration {
  const blueSteps: BuilderStep[] = [];
  const redSteps: BuilderStep[] = [];

  for (const step of sequence.steps) {
    const blue = step.motions[MotionColor.BLUE];
    const red = step.motions[MotionColor.RED];
    if (isVisibleMotion(blue)) blueSteps.push(motionToBuilderStep(blue));
    if (isVisibleMotion(red)) redSteps.push(motionToBuilderStep(red));
  }

  const startPoses: Partial<Record<MotionColor, BuilderStartPose>> = {};
  const start = sequence.startingPosition ?? sequence.startPosition;
  const startBlue = start?.motions?.[MotionColor.BLUE];
  const startRed = start?.motions?.[MotionColor.RED];

  if (isVisibleMotion(startBlue)) {
    startPoses[MotionColor.BLUE] = {
      location: startBlue.startLocation,
      orientation: startBlue.startOrientation,
    };
  } else if (blueSteps[0]) {
    startPoses[MotionColor.BLUE] = {
      location: blueSteps[0].startPosition,
      orientation: blueSteps[0].startOrientation,
    };
  }

  if (isVisibleMotion(startRed)) {
    startPoses[MotionColor.RED] = {
      location: startRed.startLocation,
      orientation: startRed.startOrientation,
    };
  } else if (redSteps[0]) {
    startPoses[MotionColor.RED] = {
      location: redSteps[0].startPosition,
      orientation: redSteps[0].startOrientation,
    };
  }

  const firstVisibleMotion = sequence.steps
    .flatMap((step) => [
      step.motions[MotionColor.BLUE],
      step.motions[MotionColor.RED],
    ])
    .find(isVisibleMotion);

  return {
    blueSteps,
    redSteps,
    gridMode:
      sequence.gridMode ??
      start?.gridMode ??
      firstVisibleMotion?.gridMode ??
      GridMode.DIAMOND,
    startPoses,
  };
}

export function stepToMotion(
  step: BuilderStep,
  color: MotionColor,
  gridMode: GridMode
): MotionData {
  const motionType = resolveMotionType(step, gridMode);
  const hasNoBaseRotation =
    motionType === MotionType.DASH || motionType === MotionType.STATIC;
  const resolvedRotation =
    motionType === MotionType.FLOAT ||
    (hasNoBaseRotation && step.turnCount === 0)
      ? RotationDirection.NO_ROTATION
      : step.rotationDirection;
  const resolvedTurns = motionType === MotionType.FLOAT ? "fl" : step.turnCount;

  const motion = createMotionData({
    color,
    startLocation: step.startPosition,
    endLocation: step.endPosition,
    motionType,
    rotationDirection: resolvedRotation,
    turns: resolvedTurns,
    startOrientation: step.startOrientation,
    endOrientation: step.endOrientation,
    gridMode,
    arrowLocation: step.startPosition,
    handPath: calculateHandPath(step.startPosition, step.endPosition, gridMode),
    isVisible: true,
  });

  return withCalculatedArrowLocations({
    id: "builder-motion",
    motions: { [color]: motion },
    gridMode,
  }).motions[color]!;
}

/** Keep persisted arrow locations aligned with the canonical pictograph pipeline. */
export function withCalculatedArrowLocations<T extends PictographData>(
  pictograph: T
): T {
  const blue = pictograph.motions[MotionColor.BLUE];
  const red = pictograph.motions[MotionColor.RED];

  return {
    ...pictograph,
    motions: {
      ...(blue && {
        [MotionColor.BLUE]: {
          ...blue,
          arrowLocation: arrowLocationCalculator.calculateLocation(
            blue,
            pictograph
          ),
        },
      }),
      ...(red && {
        [MotionColor.RED]: {
          ...red,
          arrowLocation: arrowLocationCalculator.calculateLocation(
            red,
            pictograph
          ),
        },
      }),
    },
  } as T;
}

export function createStaticMotion(
  position: GridLocation,
  orientation: Orientation,
  color: MotionColor,
  gridMode: GridMode
): MotionData {
  return createMotionData({
    color,
    startLocation: position,
    endLocation: position,
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    turns: 0,
    startOrientation: orientation,
    endOrientation: orientation,
    gridMode,
    arrowLocation: position,
    isVisible: true,
  });
}

export function convertToPictographs(
  blueSteps: BuilderStep[],
  redSteps: BuilderStep[],
  gridMode: GridMode
): PictographData[] {
  const totalSteps = Math.max(blueSteps.length, redSteps.length);
  const result: PictographData[] = [];

  for (let i = 0; i < totalSteps; i++) {
    const blueStep = blueSteps[i];
    const redStep = redSteps[i];

    const motions: PictographData["motions"] = {};
    if (blueStep)
      motions[MotionColor.BLUE] = stepToMotion(
        blueStep,
        MotionColor.BLUE,
        gridMode
      );
    if (redStep)
      motions[MotionColor.RED] = stepToMotion(
        redStep,
        MotionColor.RED,
        gridMode
      );

    result.push(
      withCalculatedArrowLocations({
        id: `builder-step-${i}`,
        motions,
        gridMode,
      })
    );
  }

  return result;
}

export function convertToStartPosition(
  startPoses: Partial<Record<MotionColor, BuilderStartPose>>,
  blueSteps: BuilderStep[],
  redSteps: BuilderStep[],
  gridMode: GridMode
): PictographData | null {
  const firstBlue = blueSteps[0];
  const firstRed = redSteps[0];

  const bluePose =
    startPoses[MotionColor.BLUE] ??
    (firstBlue
      ? {
          location: firstBlue.startPosition,
          orientation: firstBlue.startOrientation,
        }
      : null);
  const redPose =
    startPoses[MotionColor.RED] ??
    (firstRed
      ? {
          location: firstRed.startPosition,
          orientation: firstRed.startOrientation,
        }
      : null);

  if (!bluePose && !redPose) return null;

  const motions: PictographData["motions"] = {};
  if (bluePose)
    motions[MotionColor.BLUE] = createStaticMotion(
      bluePose.location,
      bluePose.orientation,
      MotionColor.BLUE,
      gridMode
    );
  if (redPose)
    motions[MotionColor.RED] = createStaticMotion(
      redPose.location,
      redPose.orientation,
      MotionColor.RED,
      gridMode
    );

  return {
    id: "builder-start",
    motions,
    gridMode,
  };
}

export async function lookupLetter(
  blueMotion: MotionData,
  redMotion: MotionData,
  gridMode: GridMode
): Promise<Letter | null> {
  const letter = await motionQueryHandler.findLetterByMotionConfiguration(
    blueMotion,
    redMotion,
    gridMode
  );
  return (letter as Letter) ?? null;
}
