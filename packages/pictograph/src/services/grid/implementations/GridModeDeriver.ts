import type { IGridModeDeriver } from "../contracts/IGridModeDeriver";
import { GridLocation, GridMode } from "@tka/types";
import type { GridData } from "../../../domain/grid-models";
import type { MotionData } from "@tka/types";

export class GridModeDeriver implements IGridModeDeriver {
  private readonly cardinalLocations = [
    GridLocation.NORTH,
    GridLocation.EAST,
    GridLocation.SOUTH,
    GridLocation.WEST,
  ];
  private readonly intercardinalLocations = [
    GridLocation.NORTHEAST,
    GridLocation.SOUTHEAST,
    GridLocation.SOUTHWEST,
    GridLocation.NORTHWEST,
  ];

  deriveGridMode(blueMotion: MotionData, redMotion: MotionData): GridMode {
    const blueIsDiamond = this.usesDiamondLocations(blueMotion);
    const redIsDiamond = this.usesDiamondLocations(redMotion);

    const blueIsBox = this.usesBoxLocations(blueMotion);
    const redIsBox = this.usesBoxLocations(redMotion);

    const blueIsSkewed = this.isSkewed(blueMotion);
    const redIsSkewed = this.isSkewed(redMotion);

    if (blueIsSkewed || redIsSkewed) {
      return GridMode.SKEWED;
    }

    if ((blueIsDiamond && redIsBox) || (blueIsBox && redIsDiamond)) {
      return GridMode.SKEWED;
    }

    if (blueIsDiamond && redIsDiamond) {
      return GridMode.DIAMOND;
    } else if (blueIsBox && redIsBox) {
      return GridMode.BOX;
    } else {
      console.warn(
        "GridModeDeriver: Unable to determine grid mode from motions. Defaulting to DIAMOND."
      );
      return GridMode.DIAMOND;
    }
  }

  usesDiamondLocations(motion: MotionData): boolean {
    return (
      this.cardinalLocations.includes(motion.startLocation) &&
      this.cardinalLocations.includes(motion.endLocation)
    );
  }

  usesBoxLocations(motion: MotionData): boolean {
    return (
      this.intercardinalLocations.includes(motion.startLocation) &&
      this.intercardinalLocations.includes(motion.endLocation)
    );
  }

  isSkewed(motion: MotionData): boolean {
    const startIsCardinal = this.cardinalLocations.includes(
      motion.startLocation
    );
    const endIsCardinal = this.cardinalLocations.includes(motion.endLocation);
    const startIsBox = this.intercardinalLocations.includes(
      motion.startLocation
    );
    const endIsBox = this.intercardinalLocations.includes(motion.endLocation);

    return (startIsCardinal && endIsBox) || (startIsBox && endIsCardinal);
  }

  computeGridData(blueMotion: MotionData, redMotion: MotionData): GridData {
    const gridMode = this.deriveGridMode(blueMotion, redMotion);
    return { gridMode } as GridData;
  }
}

export const gridModeDeriver = new GridModeDeriver();
