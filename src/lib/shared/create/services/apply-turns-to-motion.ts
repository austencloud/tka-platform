/**
 * Pure turn → motion transform.
 *
 * Applies a turn value to a single motion: auto-resolves rotation direction from
 * surrounding context (or the motion's own direction), handles float edge cases,
 * and recomputes end orientation. Extracted from turn-pattern-manager so the
 * construct option picker can apply the same canonical logic to its options.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { TurnValue } from "$lib/shared/create/domain/turn-pattern-data";
import {
  createMotionData,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { calculateEndOrientation } from "$lib/shared/pictograph/prop/services/orientation-calculator";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("ApplyTurnsToMotion");

/**
 * Apply a turn value to a single motion with edge-case handling.
 */
export function applyTurnToMotion(
  turnValue: TurnValue,
  currentMotion: MotionData,
  color: MotionColor,
  allSteps: readonly StepData[],
  stepIndex: number
): { motion: MotionData | null; warning?: string } {
  const motionType = currentMotion.motionType;

  // Edge case: Float cannot be applied to STATIC or DASH
  if (turnValue === "fl") {
    if (motionType === MotionType.STATIC || motionType === MotionType.DASH) {
      logger.log(`Float cannot be applied to ${motionType}, applying 0 turns`);
      return {
        motion: createUpdatedMotion(currentMotion, 0, color),
        warning: `Float converted to 0 (${motionType} cannot float)`,
      };
    }
  }

  // Handle rotation direction when applying turns > 0 to motion with no rotation
  let rotationDirection = currentMotion.rotationDirection;
  if (
    typeof turnValue === "number" &&
    turnValue > 0 &&
    rotationDirection === RotationDirection.NO_ROTATION
  ) {
    rotationDirection = findRotationContext(allSteps, stepIndex, color);
    if (rotationDirection !== currentMotion.rotationDirection) {
      logger.log(
        `Applied context rotation ${rotationDirection} to beat ${stepIndex + 1} ${color}`
      );
    }
  }

  return {
    motion: createUpdatedMotion(currentMotion, turnValue, color, rotationDirection),
  };
}

/**
 * Find rotation context by searching backwards first, then forwards.
 * Defaults to CLOCKWISE only if no rotation direction is found in either direction.
 */
function findRotationContext(
  steps: readonly StepData[],
  currentStepIndex: number,
  color: MotionColor
): RotationDirection {
  for (let i = currentStepIndex - 1; i >= 0; i--) {
    const beat = steps[i];
    if (!beat) continue;
    const motion = beat.motions?.[color];
    if (motion && motion.rotationDirection !== RotationDirection.NO_ROTATION) {
      logger.log(
        `Found backward rotation context at beat ${i + 1}: ${motion.rotationDirection}`
      );
      return motion.rotationDirection;
    }
  }

  for (let i = currentStepIndex + 1; i < steps.length; i++) {
    const beat = steps[i];
    if (!beat) continue;
    const motion = beat.motions?.[color];
    if (motion && motion.rotationDirection !== RotationDirection.NO_ROTATION) {
      logger.log(
        `Found forward rotation context at beat ${i + 1}: ${motion.rotationDirection}`
      );
      return motion.rotationDirection;
    }
  }

  logger.log(`No rotation context found for ${color}, defaulting to CLOCKWISE`);
  return RotationDirection.CLOCKWISE;
}

/**
 * Create an updated motion with a new turn value (recomputes end orientation).
 */
function createUpdatedMotion(
  currentMotion: MotionData,
  turnValue: TurnValue,
  color: MotionColor,
  rotationDirection?: RotationDirection
): MotionData {
  const currentTurns = currentMotion.turns;
  const isConvertingToFloat = currentTurns !== "fl" && turnValue === "fl";
  const isConvertingFromFloat = currentTurns === "fl" && turnValue !== "fl";

  let updatedMotionType = currentMotion.motionType;
  let updatedRotationDirection = rotationDirection ?? currentMotion.rotationDirection;
  let updatedPrefloatMotionType = currentMotion.prefloatMotionType;
  let updatedPrefloatRotationDirection = currentMotion.prefloatRotationDirection;

  if (isConvertingToFloat) {
    updatedPrefloatMotionType = currentMotion.motionType;
    updatedPrefloatRotationDirection = currentMotion.rotationDirection;
    updatedMotionType = MotionType.FLOAT;
    updatedRotationDirection = RotationDirection.NO_ROTATION;
  } else if (isConvertingFromFloat) {
    if (currentMotion.prefloatMotionType) {
      updatedMotionType = currentMotion.prefloatMotionType;
    }
    if (currentMotion.prefloatRotationDirection) {
      updatedRotationDirection = currentMotion.prefloatRotationDirection;
    }
  } else {
    const isDashOrStatic =
      updatedMotionType === MotionType.DASH || updatedMotionType === MotionType.STATIC;
    if (isDashOrStatic) {
      if (
        typeof turnValue === "number" &&
        turnValue > 0 &&
        currentMotion.rotationDirection === RotationDirection.NO_ROTATION
      ) {
        updatedRotationDirection = rotationDirection ?? RotationDirection.CLOCKWISE;
      } else if (turnValue === 0) {
        updatedRotationDirection = RotationDirection.NO_ROTATION;
      }
    }
  }

  const tempMotion = createMotionData({
    ...currentMotion,
    turns: turnValue,
    rotationDirection: updatedRotationDirection,
    motionType: updatedMotionType,
  });
  const newEndOrientation = calculateEndOrientation(tempMotion, color);

  return createMotionData({
    ...currentMotion,
    turns: turnValue,
    motionType: updatedMotionType,
    rotationDirection: updatedRotationDirection,
    prefloatMotionType: updatedPrefloatMotionType,
    prefloatRotationDirection: updatedPrefloatRotationDirection,
    endOrientation: newEndOrientation,
  });
}

/**
 * Apply pending turn values to both hands of a single option pictograph.
 *
 * Each option already carries the propagated start orientation (= previous step's
 * end orientation), so no surrounding-step context is needed — rotation falls back
 * to each motion's own direction. Returns a new PictographData; never mutates input.
 */
export function applyPendingTurnsToOption(
  option: PictographData,
  blueTurns: number | "fl",
  redTurns: number | "fl"
): PictographData {
  const blue = option.motions?.blue;
  const red = option.motions?.red;
  if (!blue || !red) return option;

  const blueResult = applyTurnToMotion(blueTurns, blue, MotionColor.BLUE, [], 0);
  const redResult = applyTurnToMotion(redTurns, red, MotionColor.RED, [], 0);

  return {
    ...option,
    motions: {
      ...option.motions,
      blue: blueResult.motion ?? blue,
      red: redResult.motion ?? red,
    },
  };
}
