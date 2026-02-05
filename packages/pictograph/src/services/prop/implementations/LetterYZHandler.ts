import type { MotionData, VectorDirection } from "@tka/types";
import { MotionType } from "@tka/types";
import type { IDirectionCalculator } from "../contracts/IDirectionCalculator";
import { getOppositeDirection } from "./DirectionUtils";

export class LetterYZHandler implements IDirectionCalculator {
  constructor(
    private motionDataSet: { red: MotionData; blue: MotionData },
    private shiftHandler: IDirectionCalculator
  ) {}

  calculate(motionData: MotionData): VectorDirection | null {
    const { shiftMotion, nonShiftMotion } = this.identifyMotions();

    if (!shiftMotion || !nonShiftMotion) {
      return null;
    }

    const shiftDirection = this.shiftHandler.calculate(shiftMotion);
    if (!shiftDirection) {
      return null;
    }

    const isThisShiftMotion = motionData.color === shiftMotion.color;
    return isThisShiftMotion
      ? shiftDirection
      : getOppositeDirection(shiftDirection);
  }

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
