/**
 * Turn Management Service
 *
 * Handles all turn-related operations for beat generation.
 * Single Responsibility: Manage turn values and rotation directions for dash/static motions.
 */

import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import {
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropContinuity } from "../../domain/models/generate-models";

// Legacy constants for rotation directions
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

export class TurnManager {
  /**
   * Set turns - exact port from legacy set_turns()
   */
  setTurns(
    beat: StepData,
    turnBlue: number | "fl",
    turnRed: number | "fl"
  ): void {
    if (!beat) return;

    // Handle blue turns - exact legacy logic
    this._setTurnForColor(beat, "blue", turnBlue);

    // Handle red turns - exact legacy logic
    this._setTurnForColor(beat, "red", turnRed);
  }

  /**
   * Helper to set turn for a specific color (reduces duplication)
   */
  private _setTurnForColor(
    beat: StepData,
    color: "blue" | "red",
    turn: number | "fl"
  ): void {
    const motion = beat.motions[color];
    if (!motion) return;

    if (turn === "fl") {
      // Float conversion logic
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
      // Numeric turn value
      beat.motions[color] = {
        ...motion,
        turns: turn,
      };
    }
  }

  /**
   * Update dash/static prop rotation directions - exact port from legacy
   */
  updateDashStaticRotationDirections(
    beat: StepData,
    propContinuity: PropContinuity,
    blueRotationDirection: string,
    redRotationDirection: string
  ): void {
    if (!beat) return;

    // Update blue
    this._updateRotationForColor(
      beat,
      "blue",
      propContinuity,
      blueRotationDirection
    );

    // Update red
    this._updateRotationForColor(
      beat,
      "red",
      propContinuity,
      redRotationDirection
    );
  }

  /**
   * Helper to update rotation direction for a specific color
   */
  private _updateRotationForColor(
    beat: StepData,
    color: "blue" | "red",
    propContinuity: PropContinuity,
    rotationDirection: string
  ): void {
    const motion = beat.motions[color];
    if (!motion) return;

    // Only update dash or static motions
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
      // No turns means no rotation - the prop is held still
      newRotationDirection = ROTATION_DIRS.noRotation;
    } else if (propContinuity === PropContinuity.CONTINUOUS) {
      // Continuous: inherit the previous beat's direction. If the caller
      // didn't supply one (first beat, or upstream chain was all static),
      // fall back to random so we never emit an empty/noRotation value
      // on a motion that's supposed to spin.
      const isValidInherit =
        rotationDirection === ROTATION_DIRS.CLOCKWISE ||
        rotationDirection === ROTATION_DIRS.COUNTER_CLOCKWISE;
      newRotationDirection = isValidInherit
        ? (rotationDirection as RotationDirection)
        : this.getRandomRotationDirection();
    } else {
      // Random: randomly choose rotation
      newRotationDirection = this.getRandomRotationDirection();
    }

    beat.motions[color] = {
      ...motion,
      rotationDirection: newRotationDirection,
    };
  }

  /**
   * Generate random rotation direction (clockwise or counter-clockwise)
   */
  getRandomRotationDirection(): RotationDirection {
    const options = [ROTATION_DIRS.CLOCKWISE, ROTATION_DIRS.COUNTER_CLOCKWISE];
    return options[Math.floor(Math.random() * options.length)]!;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const turnManager = new TurnManager();
