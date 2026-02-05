/**
 * Letter I Handler
 *
 * Letter I has unique direction rules that use special lookup tables.
 */

import type { MotionData } from "../../../shared/domain/models/MotionData";
import type { Loc } from "../../domain/direction/DirectionMaps";
import {
  LETTER_I_NON_RADIAL_MAP,
  LETTER_I_RADIAL_MAP,
} from "../../domain/direction/DirectionMaps";
import type { IDirectionCalculator } from "../contracts/IDirectionCalculator";
import type { IOrientationChecker } from "../contracts/IOrientationChecker";
import { getEndLocation } from "./DirectionUtils";
import type {
  MotionColor,
  VectorDirection,
} from "../../../shared/domain/enums/pictograph-enums";

export class LetterIHandler implements IDirectionCalculator {
  constructor(private orientationChecker: IOrientationChecker) {}

  /**
   * Calculate direction using Letter I's special maps.
   */
  calculate(motionData: MotionData): VectorDirection | null {
    const isRadial = this.orientationChecker.isRadial();
    const endLocation = getEndLocation(motionData);

    const map = isRadial ? LETTER_I_RADIAL_MAP : LETTER_I_NON_RADIAL_MAP;
    return map[endLocation as Loc][motionData.color as MotionColor] ?? null;
  }
}
