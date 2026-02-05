import type { GridLocation, Orientation, RotationDirection } from "@tka/types";

export interface IAngleCalculator {
  normalizeAnglePositive(angle: number): number;
  normalizeAngleSigned(angle: number): number;
  mapPositionToAngle(loc: GridLocation): number;
  mapOrientationToAngle(ori: Orientation, centerPathAngle: number): number;
  lerp(a: number, b: number, t: number): number;
  lerpAngle(a: number, b: number, t: number): number;
  lerpAngleDirectional(
    startAngle: number,
    endAngle: number,
    direction: RotationDirection,
    progress: number
  ): number;
}
