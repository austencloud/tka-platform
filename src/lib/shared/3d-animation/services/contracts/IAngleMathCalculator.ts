/**
 * IAngleMathCalculator Contract
 *
 * Service for angle normalization and interpolation.
 * Core mathematical operations used throughout the 3D animation system.
 */

import type { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export interface IAngleMathCalculator {
  /**
   * Normalize angle to [0, 2π)
   */
  normalizeAngle(angle: number): number;

  /**
   * Normalize angle to signed range (-π, π]
   * Used for calculating shortest path differences
   */
  normalizeAngleSigned(angle: number): number;

  /**
   * Linear interpolation between two values
   */
  lerp(a: number, b: number, t: number): number;

  /**
   * Interpolate angle taking shortest path
   */
  lerpAngle(a: number, b: number, t: number): number;

  /**
   * Interpolate angle with explicit direction (CW, CCW, or shortest path)
   */
  lerpAngleDirectional(
    start: number,
    end: number,
    direction: RotationDirection,
    t: number
  ): number;
}
