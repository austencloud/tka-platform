import { GridLocation, MotionColor, VectorDirection } from "@tka/types";
import type { MotionData } from "@tka/types";
import type { DiamondLoc, BoxLoc } from "../../../constants/DirectionMaps";
import {
  DIAMOND_NON_RADIAL_MAP,
  DIAMOND_RADIAL_MAP,
  BOX_NON_RADIAL_MAP,
  BOX_RADIAL_MAP,
} from "../../../constants/DirectionMaps";
import type { IDirectionCalculator } from "../contracts/IDirectionCalculator";
import type { IOrientationChecker } from "../contracts/IOrientationChecker";
import { getEndLocation, getOppositeDirection } from "./DirectionUtils";

export class LetterGHHandler implements IDirectionCalculator {
  constructor(private orientationChecker: IOrientationChecker) {}

  calculate(motionData: MotionData): VectorDirection | null {
    const isRadial = this.orientationChecker.isRadial();
    const endLocation = getEndLocation(motionData);

    const baseDirection = this.getBaseDirection(isRadial, endLocation);
    if (!baseDirection) {
      return null;
    }

    return motionData.color === "red"
      ? baseDirection
      : getOppositeDirection(baseDirection);
  }

  private getBaseDirection(
    isRadial: boolean,
    endLocation: string
  ): VectorDirection | null {
    if (!endLocation) {
      return null;
    }

    if (endLocation === "s" || endLocation === GridLocation.SOUTH) {
      return VectorDirection.RIGHT;
    }

    const isBoxLocation = [
      GridLocation.NORTHEAST,
      GridLocation.SOUTHEAST,
      GridLocation.SOUTHWEST,
      GridLocation.NORTHWEST,
    ].includes(endLocation as GridLocation);

    if (isBoxLocation) {
      const boxMap = isRadial ? BOX_RADIAL_MAP : BOX_NON_RADIAL_MAP;
      return boxMap[endLocation as BoxLoc][MotionColor.RED] ?? null;
    }

    const diamondMap = isRadial ? DIAMOND_RADIAL_MAP : DIAMOND_NON_RADIAL_MAP;
    return diamondMap[endLocation as DiamondLoc][MotionColor.RED] ?? null;
  }
}
