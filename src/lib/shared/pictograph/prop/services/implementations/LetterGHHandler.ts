/**
 * Letter G/H Handler
 *
 * Letters G and H use override logic:
 * - Red gets the base direction
 * - Blue gets the opposite direction
 */

import { GridLocation } from "../../../grid/domain/enums/grid-enums";
import {
  MotionColor,
  VectorDirection,
} from "../../../shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../../shared/domain/models/MotionData";
import type { DiamondLoc, BoxLoc } from "../../domain/direction/DirectionMaps";
import {
  DIAMOND_NON_RADIAL_MAP,
  DIAMOND_RADIAL_MAP,
  BOX_NON_RADIAL_MAP,
  BOX_RADIAL_MAP,
} from "../../domain/direction/DirectionMaps";
import type { IDirectionCalculator } from "../contracts/IDirectionCalculator";
import type { OrientationChecker } from "./OrientationChecker";
import { getEndLocation, getOppositeDirection } from "./DirectionUtils";

export class LetterGHHandler implements IDirectionCalculator {
  constructor(private orientationChecker: OrientationChecker) {}

  /**
   * Calculate direction using G/H override logic.
   *
   * Red gets base direction, blue gets opposite.
   */
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

  /**
   * Get base motion direction for G/H letters.
   */
  private getBaseDirection(
    isRadial: boolean,
    endLocation: string
  ): VectorDirection | null {
    // Guard: empty or invalid location
    if (!endLocation) {
      return null;
    }

    // Special case: South location always returns RIGHT
    if (endLocation === "s" || endLocation === GridLocation.SOUTH) {
      return VectorDirection.RIGHT;
    }

    // Check if it's a box location (NE/SE/SW/NW)
    const boxLocations: GridLocation[] = [
      GridLocation.NORTHEAST,
      GridLocation.SOUTHEAST,
      GridLocation.SOUTHWEST,
      GridLocation.NORTHWEST,
    ];
    const isBoxLocation = boxLocations.includes(endLocation as GridLocation);

    if (isBoxLocation) {
      // Use box maps for box mode pictographs
      const boxMap = isRadial ? BOX_RADIAL_MAP : BOX_NON_RADIAL_MAP;
      const boxEntry = boxMap[endLocation as BoxLoc];
      return boxEntry?.[MotionColor.RED] ?? null;
    }

    // Use diamond maps for diamond mode pictographs (N/S/E/W)
    const diamondMap = isRadial ? DIAMOND_RADIAL_MAP : DIAMOND_NON_RADIAL_MAP;
    const diamondEntry = diamondMap[endLocation as DiamondLoc];
    return diamondEntry?.[MotionColor.RED] ?? null;
  }
}
