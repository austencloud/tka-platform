import type { MotionData, VectorDirection } from "@tka/types";
import type { Loc } from "../../../constants/DirectionMaps";
import {
  SHIFT_NON_RADIAL_MAP,
  SHIFT_RADIAL_MAP,
} from "../../../constants/DirectionMaps";
import type { IDirectionCalculator } from "../contracts/IDirectionCalculator";
import type { IOrientationChecker } from "../contracts/IOrientationChecker";
import { getEndLocation } from "./DirectionUtils";

export class ShiftMotionHandler implements IDirectionCalculator {
  constructor(private orientationChecker: IOrientationChecker) {}

  calculate(motionData: MotionData): VectorDirection | null {
    const isRadial = this.orientationChecker.isRadial();
    const startLocation = motionData.startLocation;
    const endLocation = getEndLocation(motionData);

    const map = isRadial ? SHIFT_RADIAL_MAP : SHIFT_NON_RADIAL_MAP;
    return map[startLocation as Loc][endLocation as Loc] ?? null;
  }
}
