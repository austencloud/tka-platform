/**
 * Maps prop orientations to angles relative to center path.
 */

import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

const PI = Math.PI;
const HALF_PI = PI / 2;

export function mapOrientationToAngle(orientation: Orientation, centerPathAngle: number): number {
  switch (orientation) {
    case Orientation.IN:
      return centerPathAngle + PI;
    case Orientation.OUT:
      return centerPathAngle;
    case Orientation.CLOCK:
      return centerPathAngle + HALF_PI;
    case Orientation.COUNTER:
      return centerPathAngle - HALF_PI;
    default:
      return centerPathAngle;
  }
}
