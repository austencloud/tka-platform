/**
 * Turns Handler
 * Handles beat turns updates including float conversion and rotation direction auto-assignment.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/shared/foundation/domain/models/StepData";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/StartPositionData";
import { createStartPositionData } from "$lib/shared/create/factories/createStartPositionData";
import type { ICreateModuleState } from "../../types/create-module-types";
import {
  createMotionData,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type {
  MotionColor} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { reversalDetector } from "$lib/shared/create/services/reversal-detector";
import { orientationCalculator } from "$lib/shared/pictograph/prop/services/implementations/OrientationCalculator";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import {
  getStepDataFromState,
  START_POSITION_BEAT_NUMBER,
} from "./step-data-helpers";
import { calculatePropagatedSteps } from "./orientation-handler";

const logger = createComponentLogger("TurnsHandler");

/**
 * Update turns for a specific prop color in a beat
 * Handles float conversion and auto-rotation direction assignment
 */
export function updateStepTurns(
  stepNumber: number,
  color: string,
  turnAmount: number | "fl",
  createModuleState: ICreateModuleState
): void {
  const stepData = getStepDataFromState(stepNumber, createModuleState);

  if (!stepData?.motions) {
    logger.warn("Cannot update turns - no step data available");
    return;
  }

  const currentMotion: MotionData | undefined =
    stepData.motions[color as MotionColor];
  if (!currentMotion) {
    logger.warn(`No motion data for ${color}`);
    return;
  }

  const currentTurns = currentMotion.turns;

  // Detect float conversion scenarios
  const isConvertingToFloat = currentTurns !== "fl" && turnAmount === "fl";
  const isConvertingFromFloat = currentTurns === "fl" && turnAmount !== "fl";

  // Initialize updated motion properties
  let updatedMotionType = currentMotion.motionType;
  let updatedRotationDirection = currentMotion.rotationDirection;
  let updatedPrefloatMotionType = currentMotion.prefloatMotionType;
  let updatedPrefloatRotationDirection =
    currentMotion.prefloatRotationDirection;

  // Handle float conversion
  if (isConvertingToFloat) {
    updatedPrefloatMotionType = currentMotion.motionType;
    updatedPrefloatRotationDirection = currentMotion.rotationDirection;
    updatedMotionType = MotionType.FLOAT;
    updatedRotationDirection = RotationDirection.NO_ROTATION;
    logger.log(
      `Converting to float: storing prefloat state (motionType=${updatedPrefloatMotionType}, rotationDirection=${updatedPrefloatRotationDirection})`
    );
  } else if (isConvertingFromFloat) {
    if (currentMotion.prefloatMotionType) {
      updatedMotionType = currentMotion.prefloatMotionType;
    }
    if (currentMotion.prefloatRotationDirection) {
      updatedRotationDirection = currentMotion.prefloatRotationDirection;
    }
    logger.log(
      `Converting from float: restoring motion state (motionType=${updatedMotionType}, rotationDirection=${updatedRotationDirection})`
    );
  } else {
    // CRITICAL: Auto-assign rotation direction for DASH/STATIC motions (legacy behavior)
    // This matches legacy json_turns_updater.py lines 43-47 and 67-70
    const isDashOrStatic =
      updatedMotionType === MotionType.DASH ||
      updatedMotionType === MotionType.STATIC;

    if (isDashOrStatic) {
      if (
        typeof turnAmount === "number" &&
        turnAmount > 0 &&
        currentMotion.rotationDirection === RotationDirection.NO_ROTATION
      ) {
        const steps = createModuleState.sequenceState.currentSequence?.steps;
        updatedRotationDirection = steps
          ? findPreviousRotationDirection(steps, stepNumber, color as MotionColor)
          : RotationDirection.CLOCKWISE;
        logger.log(
          `Auto-assigned ${updatedRotationDirection} rotation to ${updatedMotionType} motion with ${turnAmount} turns`
        );
      } else if (turnAmount === 0) {
        updatedRotationDirection = RotationDirection.NO_ROTATION;
      }
    }
  }

  // Recalculate endOrientation based on new turn amount and updated rotation direction
  const tempMotionData = createMotionData({
    ...currentMotion,
    turns: turnAmount,
    rotationDirection: updatedRotationDirection,
    motionType: updatedMotionType,
  });
  const newEndOrientation = orientationCalculator.calculateEndOrientation(
    tempMotionData,
    color as MotionColor
  );

  // Create updated step data
  const updatedStepData = {
    ...stepData,
    motions: {
      ...stepData.motions,
      [color]: {
        ...currentMotion,
        turns: turnAmount,
        motionType: updatedMotionType,
        rotationDirection: updatedRotationDirection,
        prefloatMotionType: updatedPrefloatMotionType,
        prefloatRotationDirection: updatedPrefloatRotationDirection,
        endOrientation: newEndOrientation,
      },
    },
  };

  // Get current sequence and start position for propagation calculation
  const currentSequence: SequenceData | null =
    createModuleState.sequenceState.currentSequence;
  const startPosition: StartPositionData | null = createModuleState.sequenceState
    .selectedStartPosition ?? null;

  if (!currentSequence) {
    logger.warn("Cannot update beat - no current sequence");
    return;
  }

  // Build the updated sequence with the beat update + propagated orientations
  let updatedSequence = currentSequence;
  let updatedStartPosition: StartPositionData | null = startPosition;

  if (stepNumber === START_POSITION_BEAT_NUMBER) {
    // Create updated start position with new motions
    updatedStartPosition = startPosition
      ? createStartPositionData({
          ...startPosition,
          motions: updatedStepData.motions,
        })
      : null;
    logger.log(
      `Updated start position ${color} turns to ${turnAmount} (rotationDirection: ${updatedRotationDirection}, endOrientation: ${newEndOrientation})`
    );

    const propagatedSteps = calculatePropagatedSteps(
      stepNumber,
      color,
      currentSequence,
      updatedStartPosition
    );

    updatedSequence = {
      ...currentSequence,
      steps: propagatedSteps,
    };
  } else {
    const arrayIndex = stepNumber - 1;
    const updatedSteps = [...currentSequence.steps];
    updatedSteps[arrayIndex] = updatedStepData;

    logger.log(
      `Updated beat ${stepNumber} ${color} turns to ${turnAmount} (rotationDirection: ${updatedRotationDirection}, endOrientation: ${newEndOrientation})`
    );

    const propagatedSteps = calculatePropagatedSteps(
      stepNumber,
      color,
      { ...currentSequence, steps: updatedSteps },
      startPosition
    );

    updatedSequence = {
      ...currentSequence,
      steps: propagatedSteps,
    };
  }

  // Process reversals to update reversal indicators after turns change
  // Turns changes can affect reversals when rotation direction changes (e.g., 0 to >0 turns)
  try {
    updatedSequence = reversalDetector.processReversals(updatedSequence);
  } catch {
    // Reversal service is optional - continue without reversal processing
  }

  createModuleState.sequenceState.setCurrentSequence(updatedSequence);
}

export function findPreviousRotationDirection(
  steps: readonly StepData[],
  stepNumber: number,
  color: MotionColor
): RotationDirection {
  for (let i = stepNumber - 2; i >= 0; i--) {
    const motion = steps[i]?.motions?.[color];
    if (motion && motion.rotationDirection !== RotationDirection.NO_ROTATION) {
      return motion.rotationDirection;
    }
  }
  return RotationDirection.CLOCKWISE;
}
