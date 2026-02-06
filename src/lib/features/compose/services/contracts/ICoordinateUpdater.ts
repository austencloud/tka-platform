/**
 * Coordinate Updater Service Contract
 *
 * Handles conversion from angles to x,y coordinates
 * for prop positioning on the animation grid.
 */

import type { PropState } from "../../shared/domain/types/PropState";

export interface ICoordinateUpdater {
  /**
   * Update x,y coordinates from center path angle
   * Uses exact same logic as standalone animator with grid center offset
   */
  updateCoordinatesFromAngle(propState: PropState): void;

  /**
   * Calculate x,y coordinates from angle without modifying state
   */
  calculateCoordinatesFromAngle(centerPathAngle: number): {
    x: number;
    y: number;
  };

  /**
   * Calculate angle from x,y coordinates
   */
  calculateAngleFromCoordinates(x: number, y: number): number;
}
