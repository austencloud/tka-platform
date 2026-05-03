/**
 * Angle Calculation Service
 *
 * Handles all angle-related calculations including normalization,
 * position mapping, and orientation mapping.
 */

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  HALF_PI,
  LOCATION_ANGLES,
  PI,
  TWO_PI,
} from "../../shared/domain/math-constants.js";
// ============================================================================
// Standalone utility functions (exported for use by domain layer)
// ============================================================================

export function normalizeAnglePositive(angle: number): number {
  const norm = angle % TWO_PI;
  return norm < 0 ? norm + TWO_PI : norm;
}

export function normalizeAngleSigned(angle: number): number {
  const norm = normalizeAnglePositive(angle);
  return norm > PI ? norm - TWO_PI : norm;
}

export function mapPositionToAngle(loc: GridLocation): number {
  return LOCATION_ANGLES[loc];
}

export function mapOrientationToAngle(
  ori: Orientation,
  centerPathAngle: number
): number {
  if (ori === Orientation.IN) {
    return normalizeAnglePositive(centerPathAngle + PI);
  }

  if (ori === Orientation.OUT) {
    return normalizeAnglePositive(centerPathAngle);
  }

  if (ori === Orientation.CLOCK) {
    return normalizeAnglePositive(centerPathAngle + HALF_PI);
  }

  // Must be COUNTER (exhaustive check)
  return normalizeAnglePositive(centerPathAngle - HALF_PI);
}

// ============================================================================
// Service class (uses standalone functions internally)
// ============================================================================

export class AngleCalculator {
  /**
   * Normalize angle to positive range [0, 2π)
   */
  normalizeAnglePositive(angle: number): number {
    return normalizeAnglePositive(angle);
  }

  /**
   * Normalize angle to signed range (-π, π]
   */
  normalizeAngleSigned(angle: number): number {
    return normalizeAngleSigned(angle);
  }

  /**
   * Map grid position to angle using centralized enums
   */
  mapPositionToAngle(loc: GridLocation): number {
    return mapPositionToAngle(loc);
  }

  /**
   * Map orientation to staff angle using centralized enums
   */
  mapOrientationToAngle(ori: Orientation, centerPathAngle: number): number {
    return mapOrientationToAngle(ori, centerPathAngle);
  }

  /**
   * Linear interpolation between two values
   */
  lerp(a: number, b: number, t: number): number {
    return a * (1 - t) + b * t;
  }

  /**
   * Angular interpolation (handles wraparound) - ALWAYS TAKES SHORTEST PATH
   * ⚠️ This ignores rotation direction! Use lerpAngleDirectional for explicit direction control.
   */
  lerpAngle(a: number, b: number, t: number): number {
    const d = this.normalizeAngleSigned(b - a);
    return this.normalizeAnglePositive(a + d * t);
  }

  /**
   * Directional angular interpolation - respects explicit rotation direction from sequence data
   * This is NOT over-engineered - it directly follows the sequence data instructions!
   *
   * @param startAngle - Starting angle in radians
   * @param endAngle - Target angle in radians
   * @param direction - Explicit rotation direction from sequence data (CW, CCW, or noRotation)
   * @param progress - Interpolation progress (0 to 1)
   * @returns Interpolated angle that follows the specified direction
   */
  lerpAngleDirectional(
    startAngle: number,
    endAngle: number,
    direction: RotationDirection,
    progress: number
  ): number {
    // For noRotation (STATIC/DASH), use shortest path
    if (direction === RotationDirection.NO_ROTATION) {
      return this.lerpAngle(startAngle, endAngle, progress);
    }

    // Normalize angles to [0, 2π) range
    const start = this.normalizeAnglePositive(startAngle);
    const end = this.normalizeAnglePositive(endAngle);

    // Calculate the raw difference
    let delta = end - start;

    // Force the direction specified in the sequence data
    if (direction === RotationDirection.CLOCKWISE) {
      // Clockwise = negative rotation (in standard math coords)
      // If delta is positive, we need to go the long way (subtract 2π)
      if (delta > 0) {
        delta -= TWO_PI;
      }
      // If delta is 0, we're at the same angle - no movement needed
    } else {
      // Counter-clockwise = positive rotation
      // If delta is negative, we need to go the long way (add 2π)
      if (delta < 0) {
        delta += TWO_PI;
      }
      // If delta is 0, we're at the same angle - no movement needed
    }

    // Apply the forced direction
    return this.normalizeAnglePositive(start + delta * progress);
  }
}
