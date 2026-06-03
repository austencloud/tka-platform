/**
 * Orientation Calculator — plain function module.
 *
 * Delegates end-orientation math to the canonical calculator in
 * render/core/calculations/orientation.ts and provides pure functions
 * for propagating orientations across beats.
 */

import {
  calculateEndOrientation as calculateEndOrientationCore,
  type OrientationInput,
} from "../../../render/core/calculations/orientation";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "../../shared/domain/enums/pictograph-enums";
import {
  createMotionData,
  type MotionData,
} from "../../shared/domain/models/motion-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import { GridLocation } from "../../grid/domain/enums/grid-enums";
import { PropType } from "../domain/enums/prop-type";

/**
 * Calculate end orientation by delegating to the canonical calculator.
 */
export function calculateEndOrientation(
  motion: MotionData,
  _color: MotionColor
): Orientation {
  const input: OrientationInput = {
    motionType: motion.motionType as string,
    turns: motion.turns,
    rotationDirection: motion.rotationDirection as string,
    startLocation: motion.startLocation as string,
    endLocation: motion.endLocation as string,
    startOrientation: motion.startOrientation as string,
  };

  const result = calculateEndOrientationCore(input);

  if (result === null || result === undefined) {
    throw new Error(
      "Calculated end orientation cannot be None. " +
        "Please check the input data and orientation calculator."
    );
  }

  // Safe cast: canonical orientation string literals match enum runtime values
  return result as unknown as Orientation;
}

/**
 * Update start orientations — propagates previous beat's end orientations
 * to the next beat's start orientations.
 */
export function updateStartOrientations(
  nextStep: StepData,
  lastStep: StepData | StartPositionData
): StepData {
  if (nextStep.isBlank || ("isBlank" in lastStep && lastStep.isBlank)) {
    throw new Error("Both steps must have motion data (not be blank)");
  }

  const lastBlueMotion = lastStep.motions["blue"];
  const lastRedMotion = lastStep.motions["red"];

  if (
    !lastBlueMotion ||
    !lastRedMotion ||
    !lastBlueMotion.endOrientation ||
    !lastRedMotion.endOrientation
  ) {
    throw new Error(
      "End orientations cannot be None. Ensure the previous beat has valid orientations."
    );
  }

  const updatedMotions = { ...nextStep.motions };

  if (updatedMotions.blue) {
    updatedMotions.blue = {
      ...updatedMotions.blue,
      startOrientation: lastBlueMotion.endOrientation,
    };
  }

  if (updatedMotions.red) {
    updatedMotions.red = {
      ...updatedMotions.red,
      startOrientation: lastRedMotion.endOrientation,
    };
  }

  return {
    ...nextStep,
    motions: updatedMotions,
  };
}

/**
 * Update end orientations — calculates end orientations for both
 * blue and red motions in a beat.
 */
export function updateEndOrientations(beat: StepData): StepData {
  if (beat.isBlank) {
    throw new Error("Beat must have motion data (not be blank)");
  }

  const updatedMotions = { ...beat.motions };

  const blueMotion = beat.motions["blue"];
  if (blueMotion) {
    const blueMotionData: MotionData = createMotionData({
      motionType: blueMotion.motionType || MotionType.STATIC,
      rotationDirection:
        blueMotion.rotationDirection || RotationDirection.NO_ROTATION,
      startLocation: blueMotion.startLocation || GridLocation.NORTH,
      endLocation: blueMotion.endLocation || GridLocation.NORTH,
      turns: blueMotion.turns || 0,
      startOrientation: blueMotion.startOrientation || Orientation.IN,
      endOrientation: blueMotion.endOrientation || Orientation.IN,
      isVisible: blueMotion.isVisible ?? true,
      color: MotionColor.BLUE,
      propType: PropType.STAFF,
      arrowLocation: blueMotion.startLocation || GridLocation.NORTH,
    });

    updatedMotions.blue = {
      ...blueMotion,
      endOrientation: calculateEndOrientation(blueMotionData, MotionColor.BLUE),
    };
  }

  const redMotion = beat.motions["red"];
  if (redMotion) {
    const redMotionData: MotionData = createMotionData({
      motionType: redMotion.motionType || MotionType.STATIC,
      rotationDirection:
        redMotion.rotationDirection || RotationDirection.NO_ROTATION,
      startLocation: redMotion.startLocation || GridLocation.NORTH,
      endLocation: redMotion.endLocation || GridLocation.NORTH,
      turns: redMotion.turns || 0,
      startOrientation: redMotion.startOrientation || Orientation.IN,
      endOrientation: redMotion.endOrientation || Orientation.IN,
      isVisible: redMotion.isVisible ?? true,
      color: MotionColor.RED,
      propType: PropType.STAFF,
      arrowLocation: redMotion.startLocation || GridLocation.NORTH,
    });

    updatedMotions.red = {
      ...redMotion,
      endOrientation: calculateEndOrientation(redMotionData, MotionColor.RED),
    };
  }

  return {
    ...beat,
    motions: updatedMotions,
  };
}
