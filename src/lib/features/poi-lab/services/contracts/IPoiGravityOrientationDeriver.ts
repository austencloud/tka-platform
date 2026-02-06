/**
 * Poi Gravity Orientation Deriver Interface
 *
 * Maps grid positions to their "gravity" orientations.
 * For poi, gravity determines the natural resting orientation at each position.
 */

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface IPoiGravityOrientationDeriver {
  /**
   * Get the orientation that represents "down" (gravity/rest) at a grid location.
   *
   * Cardinal positions use cardinal orientations:
   * - N → IN (down toward center)
   * - S → OUT (down away from center)
   * - E → CLOCK (down is clockwise perpendicular)
   * - W → COUNTER (down is counter-clockwise perpendicular)
   *
   * Intercardinal positions use interradial orientations:
   * - NE → CLOCK_IN
   * - SE → CLOCK_OUT
   * - SW → COUNTER_OUT
   * - NW → COUNTER_IN
   */
  getGravityOrientation(location: GridLocation): Orientation;

  /**
   * Check if an orientation is the gravity orientation for a location.
   * Used to validate FLOAT motions (only valid at gravity orientation).
   */
  isGravityOrientation(location: GridLocation, orientation: Orientation): boolean;
}
