/**
 * Step Converter — converts PictographData to StepData and StartPositionData.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionType,
  RotationDirection,
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import { createStartPositionData } from "$lib/shared/foundation/domain/factories/create-start-position-data";

/**
 * Convert PictographData to StepData.
 */
export function convertToStep(
  pictograph: PictographData,
  stepNumber: number,
  gridMode: GridMode
): StepData {
  const motions = ensureMotionsWithGridMode(pictograph, gridMode);

  return createStepData({
    ...pictograph,
    stepNumber: stepNumber,
    duration: 1.0,
    blueReversal: false,
    redReversal: false,
    isBlank: false,
    motions,
  });
}

/**
 * Convert PictographData to StartPositionData.
 */
export function convertToStartPosition(
  pictograph: PictographData,
  gridMode: GridMode
): StartPositionData {
  const motions = ensureMotionsWithGridMode(pictograph, gridMode);

  return createStartPositionData({
    ...pictograph,
    motions,
    gridPosition: pictograph.startPosition,
  });
}

function ensureMotionsWithGridMode(
  pictograph: PictographData,
  gridMode: GridMode
): Record<string, MotionData> {
  const defaultMotion: MotionData = createMotionData({
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    startLocation: GridLocation.NORTH,
    endLocation: GridLocation.NORTH,
    turns: 0,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
    gridMode: gridMode,
  });

  const blueMotion = pictograph.motions[MotionColor.BLUE];
  const redMotion = pictograph.motions[MotionColor.RED];

  return {
    [MotionColor.BLUE]: blueMotion
      ? { ...blueMotion, gridMode }
      : defaultMotion,
    [MotionColor.RED]: redMotion
      ? { ...redMotion, gridMode }
      : defaultMotion,
  };
}

/**
 * Drop-in replacement for the old singleton — keeps all constructor-injected
 * call-sites working without changes.
 */
export const stepConverter = {
  convertToStep,
  convertToStartPosition,
};
