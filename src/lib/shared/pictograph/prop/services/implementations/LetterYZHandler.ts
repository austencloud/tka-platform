/**
 * Letter Y/Z Handler
 *
 * Letters Y and Z combine a shift motion with a static/dash motion.
 * The shift motion and non-shift motion get opposite directions.
 */

import type { MotionData } from "../../../shared/domain/models/MotionData";
import type { IDirectionCalculator } from "../contracts/IDirectionCalculator";
import { getOppositeDirection } from "./DirectionUtils";
import type { VectorDirection } from "../../../shared/domain/enums/pictograph-enums";
import { MotionType } from "../../../shared/domain/enums/pictograph-enums";

export class LetterYZHandler implements IDirectionCalculator {
  constructor(
    private motionDataSet: { red: MotionData; blue: MotionData },
    private shiftHandler: IDirectionCalculator
  ) {}

  /**
   * Calculate direction for Y/Z letters.
   *
   * Finds the shift and non-shift motions, then:
   * - Shift motion gets its calculated direction
   * - Non-shift motion gets the opposite direction
   */
  calculate(motionData: MotionData): VectorDirection | null {
    const { shiftMotion, nonShiftMotion } = this.identifyMotions();

    if (!shiftMotion || !nonShiftMotion) {
      // Fallback if not a proper Y/Z configuration
      return null;
    }

    // Calculate direction from shift motion
    const shiftDirection = this.shiftHandler.calculate(shiftMotion);
    if (!shiftDirection) {
      return null;
    }

    // Determine if current motion is the shift motion
    const isThisShiftMotion = motionData.color === shiftMotion.color;
    return isThisShiftMotion
      ? shiftDirection
      : getOppositeDirection(shiftDirection);
  }

  /**
   * Identify which motion is shift and which is static/dash.
   */
  private identifyMotions(): {
    shiftMotion: MotionData | null;
    nonShiftMotion: MotionData | null;
  } {
    const { red, blue } = this.motionDataSet;

    const isShift = (motion: MotionData) =>
      [MotionType.PRO, MotionType.ANTI, MotionType.FLOAT].includes(
        motion.motionType
      );

    const shiftMotion = isShift(red) ? red : isShift(blue) ? blue : null;

    const nonShiftMotion =
      red.motionType === MotionType.STATIC
        ? red
        : blue.motionType === MotionType.STATIC
          ? blue
          : red.motionType === MotionType.DASH
            ? red
            : blue.motionType === MotionType.DASH
              ? blue
              : null;

    return { shiftMotion, nonShiftMotion };
  }
}
