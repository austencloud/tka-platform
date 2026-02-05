import type { GridPosition, PictographData } from "@tka/types";
import type { IGridPositionDeriver } from "../../grid/contracts/IGridPositionDeriver";
import type { IBetaDetector } from "../contracts/IBetaDetector";

export class BetaDetector implements IBetaDetector {
  constructor(private positionMapper: IGridPositionDeriver) {}

  isBetaPosition(position: GridPosition): boolean {
    return position.toString().startsWith("beta");
  }

  startsWithBeta(pictographData: PictographData): boolean {
    if (!pictographData.motions.blue || !pictographData.motions.red) {
      return false;
    }

    const startPosition = this.positionMapper.getGridPositionFromLocations(
      pictographData.motions.blue.startLocation,
      pictographData.motions.red.startLocation
    );

    return this.isBetaPosition(startPosition);
  }

  endsWithBeta(pictographData: PictographData): boolean {
    if (!pictographData.motions.blue || !pictographData.motions.red) {
      return false;
    }

    const redEndLocation = pictographData.motions.red.endLocation;
    const blueEndLocation = pictographData.motions.blue.endLocation;

    return redEndLocation === blueEndLocation;
  }
}
