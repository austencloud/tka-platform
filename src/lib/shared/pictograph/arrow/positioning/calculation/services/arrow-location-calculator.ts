/**
 * Arrow Location Calculator Service
 *
 * Pure algorithmic service for calculating arrow locations based on motion data.
 * Direct TypeScript port of the Python ArrowLocationCalculatorService.
 *
 * This service handles:
 * - Static motion location calculation (uses start location)
 * - Shift motion location calculation (PRO/ANTI/FLOAT using start/end pair mapping)
 * - Dash motion location calculation (with Type 3 detection support)
 *
 * No UI dependencies, completely testable in isolation.
 */

import type { PictographData } from "../../../../shared/domain/models/pictograph-data";
import { GridLocation } from "../../../../grid/domain/enums/grid-enums";
import { MotionType } from "../../../../shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../../../shared/domain/models/motion-data";
import { calculateDashLocationFromPictographData } from "./dash-location-calculator";


export class ArrowLocationCalculator {
  /**
   * Pure algorithmic service for calculating arrow locations.
   *
   * Implements location calculation algorithms without any UI dependencies.
   * Each motion type has its own calculation strategy.
   */

  // Direction pairs mapping for shift arrows (PRO/ANTI/FLOAT)
  // Maps start/end location pairs to their calculated arrow location
  private readonly shiftDirectionPairs: Record<string, GridLocation> = {
    // Cardinal + Adjacent Cardinal combinations (normal shifts)
    [this.createLocationPairKey([GridLocation.NORTH, GridLocation.EAST])]:
      GridLocation.NORTHEAST,
    [this.createLocationPairKey([GridLocation.EAST, GridLocation.SOUTH])]:
      GridLocation.SOUTHEAST,
    [this.createLocationPairKey([GridLocation.SOUTH, GridLocation.WEST])]:
      GridLocation.SOUTHWEST,
    [this.createLocationPairKey([GridLocation.WEST, GridLocation.NORTH])]:
      GridLocation.NORTHWEST,
    // Adjacent Intercardinal combinations (normal shifts)
    [this.createLocationPairKey([
      GridLocation.NORTHEAST,
      GridLocation.NORTHWEST,
    ])]: GridLocation.NORTH,
    [this.createLocationPairKey([
      GridLocation.NORTHEAST,
      GridLocation.SOUTHEAST,
    ])]: GridLocation.EAST,
    [this.createLocationPairKey([
      GridLocation.SOUTHWEST,
      GridLocation.SOUTHEAST,
    ])]: GridLocation.SOUTH,
    [this.createLocationPairKey([
      GridLocation.NORTHWEST,
      GridLocation.SOUTHWEST,
    ])]: GridLocation.WEST,

    // SKEWED motion combinations (cardinal ↔ non-adjacent intercardinal)
    // These cross through an intermediate cardinal position
    [this.createLocationPairKey([GridLocation.WEST, GridLocation.NORTHEAST])]:
      GridLocation.NORTH, // W→NE or NE→W crosses through N
    [this.createLocationPairKey([GridLocation.WEST, GridLocation.SOUTHEAST])]:
      GridLocation.SOUTH, // W→SE or SE→W crosses through S
    [this.createLocationPairKey([GridLocation.NORTH, GridLocation.SOUTHEAST])]:
      GridLocation.EAST, // N→SE or SE→N crosses through E
    [this.createLocationPairKey([GridLocation.NORTH, GridLocation.SOUTHWEST])]:
      GridLocation.WEST, // N→SW or SW→N crosses through W
    [this.createLocationPairKey([GridLocation.EAST, GridLocation.SOUTHWEST])]:
      GridLocation.SOUTH, // E→SW or SW→E crosses through S
    [this.createLocationPairKey([GridLocation.EAST, GridLocation.NORTHWEST])]:
      GridLocation.NORTH, // E→NW or NW→E crosses through N
    [this.createLocationPairKey([GridLocation.SOUTH, GridLocation.NORTHWEST])]:
      GridLocation.WEST, // S→NW or NW→S crosses through W
    [this.createLocationPairKey([GridLocation.SOUTH, GridLocation.NORTHEAST])]:
      GridLocation.EAST, // S→NE or NE→S crosses through E

    // MINUS SKEW motion combinations (cardinal ↔ adjacent intercardinal)
    // Arrow placed at the cardinal position (shorter arc, no crossing point)
    [this.createLocationPairKey([GridLocation.NORTH, GridLocation.NORTHEAST])]:
      GridLocation.NORTH, // N→NE or NE→N
    [this.createLocationPairKey([GridLocation.NORTH, GridLocation.NORTHWEST])]:
      GridLocation.NORTH, // N→NW or NW→N
    [this.createLocationPairKey([GridLocation.EAST, GridLocation.NORTHEAST])]:
      GridLocation.EAST, // E→NE or NE→E
    [this.createLocationPairKey([GridLocation.EAST, GridLocation.SOUTHEAST])]:
      GridLocation.EAST, // E→SE or SE→E
    [this.createLocationPairKey([GridLocation.SOUTH, GridLocation.SOUTHEAST])]:
      GridLocation.SOUTH, // S→SE or SE→S
    [this.createLocationPairKey([GridLocation.SOUTH, GridLocation.SOUTHWEST])]:
      GridLocation.SOUTH, // S→SW or SW→S
    [this.createLocationPairKey([GridLocation.WEST, GridLocation.SOUTHWEST])]:
      GridLocation.WEST, // W→SW or SW→W
    [this.createLocationPairKey([GridLocation.WEST, GridLocation.NORTHWEST])]:
      GridLocation.WEST, // W→NW or NW→W
  };


  calculateLocation(
    motion: MotionData,
    pictographData?: PictographData
  ): GridLocation {
    /**
     * Calculate arrow location based on motion type and data.
     *
     * Args:
     *     motion: Motion data containing type, start/end locations, rotation direction
     *     pictographData: Optional pictograph data for DASH motion Type 3 detection
     *
     * Returns:
     *     GridLocation enum value representing the calculated arrow location
     *
     * Throws:
     *     Error: If dash motion requires pictograph data but none provided
     */
    // Half-motion frames carry the halfway hand location in endLocation (halving
    // always lands on the 45° grid → a named GridLocation). Short-circuit before
    // the motion-type switch so a segment DASH never requires pictographData.
    if (motion.segment) {
      return motion.endLocation;
    }

    switch (motion.motionType) {
      case MotionType.STATIC:
        return this.calculateStaticLocation(motion);
      case MotionType.PRO:
      case MotionType.ANTI:
      case MotionType.FLOAT:
        return this.calculateShiftLocation(motion);
      case MotionType.DASH:
        return this.calculateDashLocation(motion, pictographData!);
    }
  }

  private calculateStaticLocation(motion: MotionData): GridLocation {
    /**
     * Calculate location for static arrows.
     *
     * Static arrows use their start location directly.
     *
     * Args:
     *     motion: Motion data with STATIC type
     *
     * Returns:
     *     The start location of the motion
     */
    return motion.startLocation;
  }

  private calculateShiftLocation(motion: MotionData): GridLocation {
    /**
     * Calculate location for shift arrows (PRO/ANTI/FLOAT).
     *
     * Shift arrows use a mapping from start/end location pairs to determine
     * their arrow location. This implements the proven shift location algorithm.
     *
     * Args:
     *     motion: Motion data with PRO, ANTI, or FLOAT type
     *
     * Returns:
     *     Calculated location based on start/end pair mapping
     */
    const locationPairKey = this.createLocationPairKey([
      motion.startLocation,
      motion.endLocation,
    ]);
    const calculatedLocation =
      this.shiftDirectionPairs[locationPairKey] ?? motion.startLocation;


    return calculatedLocation;
  }

  private calculateDashLocation(
    motion: MotionData,
    pictographData: PictographData
  ): GridLocation {
    /**
     * Calculate location for dash arrows.
     *
     * Dash arrows use specialized logic that require pictograph data
     * for Type 3 detection and other special cases.
     *
     * Args:
     *     motion: Motion data with DASH type
     *     pictographData: Pictograph data for Type 3 detection
     *
     * Returns:
     *     Calculated dash location
     *
     * Throws:
     *     Error: If pictograph data is required but not provided
     */
    const isBlueArrow = this.isBlueArrowMotion(motion, pictographData);

    return calculateDashLocationFromPictographData(pictographData, isBlueArrow);
  }

  getSupportedMotionTypes(): MotionType[] {
    /**
     * Get list of motion types supported by this calculator.
     *
     * Returns:
     *     List of supported MotionType enum values
     */
    return [
      MotionType.STATIC,
      MotionType.PRO,
      MotionType.ANTI,
      MotionType.FLOAT,
      MotionType.DASH,
    ];
  }

  validateMotionData(motion: MotionData): boolean {
    /**
     * Validate that motion data is suitable for location calculation.
     *
     * Args:
     *     motion: Motion data to validate
     *
     * Returns:
     *     True if motion data is valid for location calculation
     */
    if (!this.getSupportedMotionTypes().includes(motion.motionType)) {
      return false;
    }

    // All motion data fields are required per the MotionData interface
    return true;
  }

  isBlueArrowMotion(
    motion: MotionData,
    pictographData: PictographData
  ): boolean {
    /**Determine if the given motion belongs to the blue arrow.*/
    // Compare the motion with blue and red motions in pictograph data
    if (pictographData.motions.left === motion) {
      return true;
    }
    if (pictographData.motions.right === motion) {
      return false;
    }
    // Fallback: if we can't determine, assume blue
    console.warn("Could not determine arrow color for motion, assuming blue");
    return true;
  }

  /**
   * Create a normalized key for location pairs to enable bidirectional lookup.
   * This ensures that [A, B] and [B, A] produce the same key.
   */
  private createLocationPairKey(locations: GridLocation[]): string {
    // Sort locations to ensure consistent key regardless of order
    const sortedLocations = [...locations].sort();
    return sortedLocations.join(",");
  }
}

// Use this instead of arrowLocationCalculator to avoid DI container rebuilds.

export const arrowLocationCalculator = new ArrowLocationCalculator();
