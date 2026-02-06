/**
 * Static/Dash Motion Handler Implementation
 */

import { GridLocation, GridMode } from "../../../grid/domain/enums/grid-enums";
import type {
  MotionColor,
  VectorDirection,
} from "../../../shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../../shared/domain/models/MotionData";
import type { BoxLoc, DiamondLoc } from "../../domain/direction/DirectionMaps";
import {
  BOX_NON_RADIAL_MAP,
  BOX_RADIAL_MAP,
  DIAMOND_NON_RADIAL_MAP,
  DIAMOND_RADIAL_MAP,
} from "../../domain/direction/DirectionMaps";
import type { IDirectionCalculator } from "../contracts/IDirectionCalculator";
import type { IOrientationChecker } from "../contracts/IOrientationChecker";

export class StaticDashMotionHandler implements IDirectionCalculator {
  constructor(private orientationChecker: IOrientationChecker) {}

  calculate(motionData: MotionData): VectorDirection | null {
    const location = motionData.endLocation;
    const gridMode = this.getGridMode(location);
    const isRadial = this.orientationChecker.isRadial();

    if (gridMode === GridMode.DIAMOND) {
      const map = isRadial ? DIAMOND_RADIAL_MAP : DIAMOND_NON_RADIAL_MAP;
      return (
        map[location as DiamondLoc][motionData.color as MotionColor] ?? null
      );
    }

    const map = isRadial ? BOX_RADIAL_MAP : BOX_NON_RADIAL_MAP;
    return map[location as BoxLoc][motionData.color as MotionColor] ?? null;
  }

  private getGridMode(location: string): GridMode {
    const cardinalLocations = [
      GridLocation.NORTH,
      GridLocation.SOUTH,
      GridLocation.EAST,
      GridLocation.WEST,
    ] as string[];
    return cardinalLocations.includes(location)
      ? GridMode.DIAMOND
      : GridMode.BOX;
  }
}
