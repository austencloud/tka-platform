/**
 * AngleMathCalculator Implementation
 *
 * Provides angle normalization and interpolation operations.
 */

import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
const TWO_PI = Math.PI * 2;
const PI = Math.PI;

export class AngleMathCalculator {
  /**
   * Normalize angle to [0, 2π)
   */
  normalizeAngle(angle: number): number {
    let normalized = angle % TWO_PI;
    if (normalized < 0) normalized += TWO_PI;
    return normalized;
  }

  /**
   * Normalize angle to signed range (-π, π]
   */
  normalizeAngleSigned(angle: number): number {
    const norm = this.normalizeAngle(angle);
    return norm > PI ? norm - TWO_PI : norm;
  }

  /**
   * Linear interpolation between two values
   */
  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Interpolate angle taking shortest path
   */
  lerpAngle(a: number, b: number, t: number): number {
    const diff = b - a;

    // Normalize difference to [-π, π]
    let normalizedDiff = diff % TWO_PI;
    if (normalizedDiff > PI) normalizedDiff -= TWO_PI;
    if (normalizedDiff < -PI) normalizedDiff += TWO_PI;

    return this.normalizeAngle(a + normalizedDiff * t);
  }

  /**
   * Interpolate angle with explicit direction (CW, CCW, or shortest path)
   */
  lerpAngleDirectional(
    start: number,
    end: number,
    direction: RotationDirection,
    t: number
  ): number {
    if (direction === RotationDirection.NO_ROTATION) {
      return this.lerpAngle(start, end, t);
    }

    let delta = end - start;

    // Force direction
    if (direction === RotationDirection.CLOCKWISE) {
      // Clockwise = negative in canvas coords
      if (delta > 0) delta -= TWO_PI;
    } else {
      // Counter-clockwise = positive
      if (delta < 0) delta += TWO_PI;
    }

    return this.normalizeAngle(start + delta * t);
  }
}
