/**
 * IUFOStarScanner - Handles star discovery and memory for UFO scanning behavior
 *
 * Manages finding nearby stars for the UFO to scan, tracking which stars
 * have been scanned recently to avoid repetition, and locating stars
 * near specific positions.
 */

import type { UFO, StarInfo } from "../domain/ufo-types";
import type { Dimensions } from "../../../shared/domain/types/background-types";

export interface IUFOStarScanner {
  /**
   * Find a bright star near the UFO that hasn't been recently scanned
   * Returns null if no suitable star is found
   */
  findNearbyBrightStar(
    ufo: UFO,
    dimensions: Dimensions,
    starProvider: () => StarInfo[]
  ): StarInfo | null;

  /**
   * Find the star closest to a given position
   * Used for tracking stars that may have drifted due to parallax
   */
  findStarNearPosition(
    targetX: number,
    targetY: number,
    starProvider: () => StarInfo[]
  ): StarInfo | null;

  /**
   * Remember that a star at this position was scanned
   * Prevents rescanning the same star repeatedly
   */
  rememberScannedStar(ufo: UFO, x: number, y: number): void;

  /**
   * Generate a grid key for a star position (for memory lookup)
   */
  getStarKey(x: number, y: number): string;
}
