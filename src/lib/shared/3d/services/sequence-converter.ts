/**
 * Converts SequenceData steps to MotionConfig3D.
 * Bridges the gap between 2D sequence data model and 3D animation system.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import type { MotionConfig3D } from "../domain/models/motion-data-3d";
import { Plane } from "@austencloud/scene-3d";
import {
  MotionColor,
  MotionType,
  RotationDirection,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { PlaneModeConfig } from "@austencloud/scene-3d";

export interface StepMotionConfigs {
  stepNumber: number;
  blue: MotionConfig3D | null;
  red: MotionConfig3D | null;
}

/** Convert a MotionData object to MotionConfig3D */
export function motionDataToConfig3D(
  motion: MotionData,
  fallbackPlane: Plane = Plane.WALL,
): MotionConfig3D {
  const turns = motion.turns === "fl" ? 0 : (motion.turns as number);
  const plane = motion.plane ?? fallbackPlane;

  return {
    plane,
    startLocation: motion.startLocation,
    endLocation: motion.endLocation,
    motionType: motion.motionType,
    rotationDirection: motion.rotationDirection,
    turns,
    startOrientation: motion.startOrientation,
    endOrientation: motion.endOrientation,
    pathShape: motion.pathShape,
  };
}

/** Extract motion configs from a StepData or StartPositionData object */
export function stepDataToConfigs(
  step: StepData | StartPositionData,
  plane: Plane = Plane.WALL,
  modeConfig?: PlaneModeConfig,
): StepMotionConfigs {
  const blueMotion = step.motions?.[MotionColor.BLUE];
  const redMotion = step.motions?.[MotionColor.RED];

  const stepNumber =
    "isStartPosition" in step && step.isStartPosition
      ? 0
      : (step as StepData).stepNumber ?? 0;

  const bluePlane = modeConfig?.bluePlane ?? plane;
  const redPlane = modeConfig?.redPlane ?? plane;
  const rotPlane = modeConfig?.rotationPlane;

  return {
    stepNumber,
    blue:
      blueMotion && blueMotion.isVisible !== false
        ? {
            ...motionDataToConfig3D(blueMotion, bluePlane),
            ...(modeConfig ? { plane: bluePlane } : {}),
            rotationPlane: rotPlane,
          }
        : null,
    red:
      redMotion && redMotion.isVisible !== false
        ? {
            ...motionDataToConfig3D(redMotion, redPlane),
            ...(modeConfig ? { plane: redPlane } : {}),
            rotationPlane: rotPlane,
          }
        : null,
  };
}

/** Derive a static start position config from a motion step's starting angles. */
function deriveStartConfigFromStep(
  step: StepData | StartPositionData,
  plane: Plane,
  modeConfig?: PlaneModeConfig,
): StepMotionConfigs {
  const blueMotion = step.motions?.[MotionColor.BLUE];
  const redMotion = step.motions?.[MotionColor.RED];

  const bluePlane = modeConfig?.bluePlane ?? plane;
  const redPlane = modeConfig?.redPlane ?? plane;

  return {
    stepNumber: 0,
    blue: blueMotion
      ? {
          plane: bluePlane,
          startLocation: blueMotion.startLocation,
          endLocation: blueMotion.startLocation,
          motionType: MotionType.STATIC,
          rotationDirection: RotationDirection.NO_ROTATION,
          turns: 0,
          startOrientation: blueMotion.startOrientation,
          endOrientation: blueMotion.startOrientation,
        }
      : null,
    red: redMotion
      ? {
          plane: redPlane,
          startLocation: redMotion.startLocation,
          endLocation: redMotion.startLocation,
          motionType: MotionType.STATIC,
          rotationDirection: RotationDirection.NO_ROTATION,
          turns: 0,
          startOrientation: redMotion.startOrientation,
          endOrientation: redMotion.startOrientation,
        }
      : null,
  };
}

/**
 * Convert an entire sequence to an array of step motion configs.
 * Filters out step 0 (start position).
 */
export function sequenceToMotionConfigs(
  sequence: SequenceData,
  plane: Plane = Plane.WALL,
  modeConfig?: PlaneModeConfig,
): StepMotionConfigs[] {
  if (!sequence.steps || sequence.steps.length === 0) {
    return [];
  }

  return sequence.steps
    .filter((step) => step.stepNumber !== 0)
    .map((step) => stepDataToConfigs(step, plane, modeConfig))
    .sort((a, b) => a.stepNumber - b.stepNumber);
}

/** Get start position configs from sequence */
export function getStartPositionConfigs(
  sequence: SequenceData,
  plane: Plane = Plane.WALL,
  modeConfig?: PlaneModeConfig,
): StepMotionConfigs | null {
  if (sequence.startPosition) {
    return stepDataToConfigs(sequence.startPosition, plane, modeConfig);
  }

  const step0 = sequence.steps?.find((step) => step.stepNumber === 0);
  if (step0) {
    return stepDataToConfigs(step0, plane, modeConfig);
  }

  if (sequence.startingPosition) {
    return stepDataToConfigs(sequence.startingPosition, plane, modeConfig);
  }

  const firstStep = sequence.steps?.find((step) => step.stepNumber !== 0);
  if (firstStep) {
    return deriveStartConfigFromStep(firstStep, plane, modeConfig);
  }

  return null;
}

/** Create default motion config */
export function createDefaultConfig(plane: Plane = Plane.WALL): MotionConfig3D {
  return {
    plane,
    startLocation: GridLocation.NORTH,
    endLocation: GridLocation.NORTH,
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    turns: 0,
    startOrientation: Orientation.IN,
    endOrientation: Orientation.IN,
  };
}
