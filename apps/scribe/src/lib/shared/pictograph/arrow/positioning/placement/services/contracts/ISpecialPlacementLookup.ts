/**
 * Special Placement Lookup Contract
 *
 * Performs lookups in special placement data with fallback strategies.
 */

import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { Point } from "fabric";

export interface ISpecialPlacementLookup {
  /**
   * Look up special placement adjustment from placement data.
   * Applies fallback strategies based on letter type (hybrid vs non-hybrid).
   *
   * @param letterData Special placement data for the letter
   * @param turnsTuple Turns tuple string
   * @param motionData Motion data
   * @param pictographData Pictograph data
   * @param arrowColor Arrow color ('red' or 'blue')
   * @param attributeKey Optional attribute key for precise lookup
   * @returns Point adjustment or null if not found
   */
  lookupAdjustment(
    letterData: Record<string, unknown>,
    turnsTuple: string,
    motionData: MotionData,
    pictographData: PictographData,
    arrowColor?: string,
    attributeKey?: string
  ): Point | null;

  /**
   * Look up rotation angle override flag from placement data.
   *
   * @param letterData Special placement data for the letter
   * @param turnsTuple Turns tuple string
   * @param rotationOverrideKey Rotation override key
   * @param letter The letter to look up (e.g., "Z")
   * @returns true if override flag exists and is true
   */
  lookupRotationOverride(
    letterData: Record<string, unknown>,
    turnsTuple: string,
    rotationOverrideKey: string,
    letter: string
  ): boolean;
}
