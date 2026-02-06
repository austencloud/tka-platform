/**
 * Angle Calculator Service Contract
 *
 * Handles all angle-related calculations including normalization,
 * position mapping, and orientation mapping.
 */

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type {
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface IAngleCalculator {
  /**
   * Normalize angle to positive range [0, 2π)
   */
  normalizeAnglePositive(angle: number): number;

  /**
   * Normalize angle to signed range (-π, π]
   */
  normalizeAngleSigned(angle: number): number;

  /**
   * Map grid position to angle using centralized enums
   */
  mapPositionToAngle(loc: GridLocation): number;

  /**
   * Map orientation to staff angle using centralized enums
   */
  mapOrientationToAngle(ori: Orientation, centerPathAngle: number): number;

  /**
   * Linear interpolation between two values
   */
  lerp(a: number, b: number, t: number): number;

  /**
   * Angular interpolation (handles wraparound) - always takes shortest path
   */
  lerpAngle(a: number, b: number, t: number): number;

  /**
   * Directional angular interpolation - respects explicit rotation direction from sequence data
   */
  lerpAngleDirectional(
    startAngle: number,
    endAngle: number,
    direction: RotationDirection,
    progress: number
  ): number;
}
