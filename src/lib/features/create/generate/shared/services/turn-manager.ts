/**
 * Turn Manager — turn values and rotation directions for dash/static motions.
 */

import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import {
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropContinuity } from "../domain/models/generate-models";

// This module mutates generator-owned draft steps in place (legacy port
// contract: void functions, callers rely on mutation). StepMotions is
// readonly for everyone else; the drafts here are freshly built copies.
type MutableStepMotions = { blue: MotionData; red: MotionData };
const mutableMotions = (step: StepData): MutableStepMotions =>
  step.motions as MutableStepMotions;

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
  step: StepData,
  turnBlue: number | "fl",
  turnRed: number | "fl"
): void {
  if (!step) return;
  setTurnForColor(step, "blue", turnBlue);
  setTurnForColor(step, "red", turnRed);
}

/**
 * Update dash/static prop rotation directions — exact port from legacy.
 */
export function updateDashStaticRotationDirections(
  step: StepData,
  propContinuity: PropContinuity,
  blueRotationDirection: string,
  redRotationDirection: string
): void {
  if (!step) return;
  updateRotationForColor(step, "blue", propContinuity, blueRotationDirection);
  updateRotationForColor(step, "red", propContinuity, redRotationDirection);
}

export function getRandomRotationDirection(): RotationDirection {
  const options = [ROTATION_DIRS.CLOCKWISE, ROTATION_DIRS.COUNTER_CLOCKWISE];
  return options[Math.floor(Math.random() * options.length)]!;
}

function setTurnForColor(
  step: StepData,
  color: "blue" | "red",
  turn: number | "fl"
): void {
  const motion = step.motions[color];
  if (!motion) return;

  if (turn === "fl") {
    if (
      motion.motionType === MotionType.PRO ||
      motion.motionType === MotionType.ANTI
    ) {
      mutableMotions(step)[color] = {
        ...motion,
        turns: "fl",
        prefloatMotionType: motion.motionType,
        prefloatRotationDirection: motion.rotationDirection,
        motionType: MotionType.FLOAT,
        rotationDirection: RotationDirection.NO_ROTATION,
      };
    } else {
      mutableMotions(step)[color] = {
        ...motion,
        turns: 0,
      };
    }
  } else {
    mutableMotions(step)[color] = {
      ...motion,
      turns: turn,
    };
  }
}

function updateRotationForColor(
  step: StepData,
  color: "blue" | "red",
  propContinuity: PropContinuity,
  rotationDirection: string
): void {
  const motion = step.motions[color];
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

  mutableMotions(step)[color] = {
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
