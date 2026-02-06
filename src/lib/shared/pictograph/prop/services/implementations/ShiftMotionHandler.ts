/**
 * Shift Motion Handler
 *
 * Handles direction calculation for SHIFT motions (PRO, ANTI, FLOAT).
 */

import type { MotionData } from "../../../shared/domain/models/MotionData";
import type { Loc } from "../../domain/direction/DirectionMaps";
import {
  SHIFT_NON_RADIAL_MAP,
  SHIFT_RADIAL_MAP,
} from "../../domain/direction/DirectionMaps";
import type { IDirectionCalculator } from "../contracts/IDirectionCalculator";
import type { IOrientationChecker } from "../contracts/IOrientationChecker";
import { getEndLocation } from "./DirectionUtils";
import type { VectorDirection } from "../../../shared/domain/enums/pictograph-enums";

export class ShiftMotionHandler implements IDirectionCalculator {
  constructor(private orientationChecker: IOrientationChecker) {}

  /**
   * Calculate direction for shift motions based on start→end transition.
   */
  calculate(motionData: MotionData): VectorDirection | null {
    const isRadial = this.orientationChecker.isRadial();
    const startLocation = motionData.startLocation;
    const endLocation = getEndLocation(motionData);

    const map = isRadial ? SHIFT_RADIAL_MAP : SHIFT_NON_RADIAL_MAP;
    return map[startLocation as Loc][endLocation as Loc] ?? null;
  }
}
