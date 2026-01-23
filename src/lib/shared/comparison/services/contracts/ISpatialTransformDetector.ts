/**
 * Spatial Transform Detector Contract
 *
 * Detects what spatial transform (if any) relates two beats or sequences.
 * A spatial transform is a rotation around the grid center (0-7 steps of 45°).
 */

import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SpatialTransform, SpatialTransformResult } from "../../domain/models/signatures";

export interface ISpatialTransformDetector {
  /**
   * Find the spatial transform that maps beatA to beatB.
   *
   * Tries all 8 possible rotations (0°, 45°, 90°, ..., 315°) to find
   * one that makes beatA equivalent to beatB.
   *
   * @param beatA - Source beat
   * @param beatB - Target beat
   * @returns Result indicating if transform found and what it is
   */
  findTransform(beatA: StepData, beatB: StepData): SpatialTransformResult;

  /**
   * Check if beatB is a specific spatial rotation of beatA.
   *
   * @param beatA - Source beat
   * @param beatB - Target beat
   * @param rotationSteps - Number of 45° clockwise steps to check
   * @returns true if beatB equals beatA rotated by specified amount
   */
  isRotationOf(beatA: StepData, beatB: StepData, rotationSteps: number): boolean;

  /**
   * Rotate a grid location by a number of 45° steps clockwise.
   *
   * @param location - Original location
   * @param steps - Number of 45° clockwise steps (can be negative for ccw)
   * @returns The rotated location
   */
  rotateLocation(location: GridLocation, steps: number): GridLocation;

  /**
   * Get all 8 possible spatial transforms.
   *
   * @returns Array of transforms for 0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°
   */
  getAllTransforms(): readonly SpatialTransform[];

  /**
   * Calculate the angular distance (in 45° steps) between two locations.
   *
   * @param from - Starting location
   * @param to - Ending location
   * @returns Number of 45° steps (0-7)
   */
  getAngularDistance(from: GridLocation, to: GridLocation): number;
}
