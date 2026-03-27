/**
 * OrientationMapper Implementation
 *
 * Maps prop orientations to angles relative to center path.
 */

import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { IOrientationMapper } from "../contracts/IOrientationMapper";

const PI = Math.PI;
const HALF_PI = PI / 2;

export class OrientationMapper implements IOrientationMapper {
  /**
   * Map orientation to angle relative to center path
   */
  mapOrientationToAngle(
    orientation: Orientation,
    centerPathAngle: number
  ): number {
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
}
