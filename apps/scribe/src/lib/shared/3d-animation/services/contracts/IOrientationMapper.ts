/**
 * IOrientationMapper Contract
 *
 * Service for mapping prop orientations to angles.
 */

import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface IOrientationMapper {
  /**
   * Map orientation to angle relative to center path
   *
   * @param orientation - The prop orientation (IN, OUT, CLOCK, COUNTER)
   * @param centerPathAngle - The current center path angle in radians
   * @returns The staff angle in radians
   */
  mapOrientationToAngle(
    orientation: Orientation,
    centerPathAngle: number
  ): number;
}
