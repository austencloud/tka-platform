import type { PropState } from "@tka/types";
import { ANIMATION_CONSTANTS } from "../domain/animation-constants";
import type { ICoordinateUpdater } from "../contracts/ICoordinateUpdater";

const { GRID_CENTER, GRID_HALFWAY_POINT_OFFSET } = ANIMATION_CONSTANTS;

export class CoordinateUpdater implements ICoordinateUpdater {
  updateCoordinatesFromAngle(propState: PropState): void {
    const radius = GRID_HALFWAY_POINT_OFFSET;
    const centerX = GRID_CENTER;
    const centerY = GRID_CENTER;

    propState.x = centerX + Math.cos(propState.centerPathAngle) * radius;
    propState.y = centerY + Math.sin(propState.centerPathAngle) * radius;
  }

  calculateCoordinatesFromAngle(centerPathAngle: number): {
    x: number;
    y: number;
  } {
    const radius = GRID_HALFWAY_POINT_OFFSET;
    const centerX = GRID_CENTER;
    const centerY = GRID_CENTER;

    return {
      x: centerX + Math.cos(centerPathAngle) * radius,
      y: centerY + Math.sin(centerPathAngle) * radius,
    };
  }

  calculateAngleFromCoordinates(x: number, y: number): number {
    const centerX = GRID_CENTER;
    const centerY = GRID_CENTER;
    return Math.atan2(y - centerY, x - centerX);
  }
}
