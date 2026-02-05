import type { MotionData, MotionColor, VectorDirection } from "@tka/types";
import type { Loc } from "../../../constants/DirectionMaps";
import {
  LETTER_I_NON_RADIAL_MAP,
  LETTER_I_RADIAL_MAP,
} from "../../../constants/DirectionMaps";
import type { IDirectionCalculator } from "../contracts/IDirectionCalculator";
import type { IOrientationChecker } from "../contracts/IOrientationChecker";
import { getEndLocation } from "./DirectionUtils";

export class LetterIHandler implements IDirectionCalculator {
  constructor(private orientationChecker: IOrientationChecker) {}

  calculate(motionData: MotionData): VectorDirection | null {
    const isRadial = this.orientationChecker.isRadial();
    const endLocation = getEndLocation(motionData);

    const map = isRadial ? LETTER_I_RADIAL_MAP : LETTER_I_NON_RADIAL_MAP;
    return map[endLocation as Loc][motionData.color as MotionColor] ?? null;
  }
}
