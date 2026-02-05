import type { PropState } from "@tka/types";

export interface ICoordinateUpdater {
  updateCoordinatesFromAngle(propState: PropState): void;
  calculateCoordinatesFromAngle(centerPathAngle: number): {
    x: number;
    y: number;
  };
  calculateAngleFromCoordinates(x: number, y: number): number;
}
