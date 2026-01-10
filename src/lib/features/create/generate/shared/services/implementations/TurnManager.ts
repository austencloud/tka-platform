/**
 * Turn Management Service
 *
 * Handles all turn-related operations for beat generation.
 * Single Responsibility: Manage turn values and rotation directions for dash/static motions.
 */

import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
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

export interface ITurnManager {
  /**
   * Set turns on a beat - handles both numeric turns and float conversions
   */
  setTurns(
    beat: BeatData,
    turnBlue: number | "fl",
    turnRed: number | "fl"
  ): void;

  /**
   * Update rotation directions for dash/static motions based on prop continuity
   */
  updateDashStaticRotationDirections(
    beat: BeatData,
    propContinuity: PropContinuity,
    blueRotationDirection: string,
    redRotationDirection: string
  ): void;

  /**
   * Generate random rotation direction
   */
  getRandomRotationDirection(): RotationDirection;
}

export class TurnManager implements ITurnManager {
  /**
   * Set turns - exact port from legacy set_turns()
   */
  setTurns(
    beat: BeatData,
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
    beat: BeatData,
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
    beat: BeatData,
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
    beat: BeatData,
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

    let newRotationDirection: RotationDirection;

    if (propContinuity === PropContinuity.CONTINUOUS) {
      // Continuous: use the provided rotation direction if turns > 0
      newRotationDirection =
        typeof turns === "number" && turns > 0
          ? (rotationDirection as RotationDirection)
          : ROTATION_DIRS.noRotation;
    } else {
      // Random: randomly choose rotation if turns > 0
      if (typeof turns === "number" && turns > 0) {
        newRotationDirection = this.getRandomRotationDirection();
      } else {
        newRotationDirection = ROTATION_DIRS.noRotation;
      }
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
