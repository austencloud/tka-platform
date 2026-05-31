/**
 * Turn Manager — turn values and rotation directions for dash/static motions.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import {
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropContinuity } from "../domain/models/generate-models";

const ROTATION_DIRS = {
  CLOCKWISE: RotationDirection.CLOCKWISE,
  COUNTER_CLOCKWISE: RotationDirection.COUNTER_CLOCKWISE,
  noRotation: RotationDirection.NO_ROTATION,
} as const;

const MOTION_TYPES = {
  PRO: MotionType.PRO,
  ANTI: MotionType.ANTI,
  FLOAT: MotionType.FLOAT,
  DASH: MotionType.DASH,
  STATIC: MotionType.STATIC,
} as const;

/**
 * Set turns — exact port from legacy set_turns().
 */
export function setTurns(
  beat: StepData,
  turnBlue: number | "fl",
  turnRed: number | "fl"
): void {
  if (!beat) return;
  setTurnForColor(beat, "blue", turnBlue);
  setTurnForColor(beat, "red", turnRed);
}

/**
 * Update dash/static prop rotation directions — exact port from legacy.
 */
export function updateDashStaticRotationDirections(
  beat: StepData,
  propContinuity: PropContinuity,
  blueRotationDirection: string,
  redRotationDirection: string
): void {
  if (!beat) return;
  updateRotationForColor(beat, "blue", propContinuity, blueRotationDirection);
  updateRotationForColor(beat, "red", propContinuity, redRotationDirection);
}

export function getRandomRotationDirection(): RotationDirection {
  const options = [ROTATION_DIRS.CLOCKWISE, ROTATION_DIRS.COUNTER_CLOCKWISE];
  return options[Math.floor(Math.random() * options.length)]!;
}

function setTurnForColor(
  beat: StepData,
  color: "blue" | "red",
  turn: number | "fl"
): void {
  const motion = beat.motions[color];
  if (!motion) return;

  if (turn === "fl") {
    if (
      motion.motionType === MotionType.PRO ||
      motion.motionType === MotionType.ANTI
    ) {
      beat.motions[color] = {
        ...motion,
        turns: "fl",
        prefloatMotionType: motion.motionType,
        prefloatRotationDirection: motion.rotationDirection,
        motionType: MotionType.FLOAT,
        rotationDirection: RotationDirection.NO_ROTATION,
      };
    } else {
      beat.motions[color] = {
        ...motion,
        turns: 0,
      };
    }
  } else {
    beat.motions[color] = {
      ...motion,
      turns: turn,
    };
  }
}

function updateRotationForColor(
  beat: StepData,
  color: "blue" | "red",
  propContinuity: PropContinuity,
  rotationDirection: string
): void {
  const motion = beat.motions[color];
  if (!motion) return;

  if (
    motion.motionType !== MOTION_TYPES.DASH &&
    motion.motionType !== MOTION_TYPES.STATIC
  ) {
    return;
  }

  const turns = motion.turns || 0;
  const hasTurns = typeof turns === "number" && turns > 0;

  let newRotationDirection: RotationDirection;

  if (!hasTurns) {
    newRotationDirection = ROTATION_DIRS.noRotation;
  } else if (propContinuity === PropContinuity.CONTINUOUS) {
    const isValidInherit =
      rotationDirection === ROTATION_DIRS.CLOCKWISE ||
      rotationDirection === ROTATION_DIRS.COUNTER_CLOCKWISE;
    newRotationDirection = isValidInherit
      ? (rotationDirection as RotationDirection)
      : getRandomRotationDirection();
  } else {
    newRotationDirection = getRandomRotationDirection();
  }

  beat.motions[color] = {
    ...motion,
    rotationDirection: newRotationDirection,
  };
}

/**
 * Drop-in replacement for the old singleton.
 */
export const turnManager = {
  setTurns,
  updateDashStaticRotationDirections,
  getRandomRotationDirection,
};
