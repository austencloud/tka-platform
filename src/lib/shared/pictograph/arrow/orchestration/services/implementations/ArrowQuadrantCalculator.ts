/**
 * Arrow Quadrant Calculator
 *
 * Handles quadrant index calculations for different grid modes and motion types.
 * Implements sophisticated quadrant mapping logic from desktop implementations.
 */

import {
  GridLocation,
  GridMode,
} from "../../../../grid/domain/enums/grid-enums";
import { MotionType } from "../../../../shared/domain/enums/pictograph-enums";
import type { MotionData } from "../../../../shared/domain/models/MotionData";
import type { IArrowQuadrantCalculator } from "../contracts/IArrowQuadrantCalculator";

export class ArrowQuadrantCalculator implements IArrowQuadrantCalculator {
  calculateQuadrantIndex(motion: MotionData, location: GridLocation): number {
    /**
     * Calculate quadrant index for the given motion and arrow location.
     * Uses motion-type-specific and grid-mode-specific mappings.
     */
    const gridMode = this.determineGridMode(motion, location);
    const motionType = motion.motionType;

    // Apply sophisticated quadrant mapping based on grid mode and motion type
    let result: number;
    if (gridMode === GridMode.DIAMOND) {
      if (this.isShiftMotion(motionType)) {
        result = this.diamondShiftQuadrantIndex(location);
      } else {
        result = this.diamondStaticDashQuadrantIndex(location);
      }
    } else {
      // Box grid mode
      if (this.isShiftMotion(motionType)) {
        result = this.boxShiftQuadrantIndex(location);
      } else {
        result = this.boxStaticDashQuadrantIndex(location);
      }
    }

    return result;
  }

  determineGridMode(
    motion: MotionData,
    calculatedLocation?: GridLocation
  ): GridMode {
    /**
     * Determine grid mode (diamond/box) based on motion locations.
     *
     * GRID MODE LOGIC:
     * - DIAMOND mode: Motion uses CARDINALS (N,E,S,W) → arrows placed at DIAGONALS
     * - BOX mode: Motion uses DIAGONALS (NE,SE,SW,NW) → arrows placed at CARDINALS
     *
     * For shift motions (PRO/ANTI/FLOAT), the calculated arrow location follows this pattern.
     * For dash/static motions, use the motion's start/end locations to determine the mode.
     */
    const diagonalLocations: GridLocation[] = [
      GridLocation.NORTHEAST,
      GridLocation.SOUTHEAST,
      GridLocation.SOUTHWEST,
      GridLocation.NORTHWEST,
    ];

    const cardinalLocations: GridLocation[] = [
      GridLocation.NORTH,
      GridLocation.EAST,
      GridLocation.SOUTH,
      GridLocation.WEST,
    ];

    // For shift motions (PRO, ANTI, FLOAT), use the calculated arrow location
    if (calculatedLocation && this.isShiftMotion(motion.motionType)) {
      const locationIsDiagonal = diagonalLocations.includes(calculatedLocation);

      if (locationIsDiagonal) {
        return GridMode.DIAMOND;
      } else {
        return GridMode.BOX;
      }
    }

    // For dash/static motions: Check motion start/end locations
    // If motion uses CARDINALS → DIAMOND mode (arrows at diagonals)
    // If motion uses DIAGONALS → BOX mode (arrows at cardinals)
    const startIsCardinal = cardinalLocations.includes(motion.startLocation);
    const endIsCardinal = cardinalLocations.includes(motion.endLocation);

    if (startIsCardinal || endIsCardinal) {
      return GridMode.DIAMOND;
    }

    // Motion uses diagonal locations → BOX mode
    return GridMode.BOX;
  }

  isShiftMotion(motionType: MotionType): boolean {
    /**
     * Check if motion type is a shift motion (PRO/ANTI/FLOAT).
     */
    const shiftTypes: MotionType[] = [
      MotionType.PRO,
      MotionType.ANTI,
      MotionType.FLOAT,
    ];
    return shiftTypes.includes(motionType);
  }

  diamondShiftQuadrantIndex(location: GridLocation): number {
    /**
     * Get quadrant index for shift motions (PRO/ANTI/FLOAT) in diamond grid.
     */
    const locationToIndex: Partial<Record<GridLocation, number>> = {
      [GridLocation.NORTHEAST]: 0,
      [GridLocation.SOUTHEAST]: 1,
      [GridLocation.SOUTHWEST]: 2,
      [GridLocation.NORTHWEST]: 3,
    };

    return locationToIndex[location] || 0;
  }

  diamondStaticDashQuadrantIndex(location: GridLocation): number {
    /**
     * Get quadrant index for static/dash motions in diamond grid.
     */
    const locationToIndex: Partial<Record<GridLocation, number>> = {
      [GridLocation.NORTH]: 0,
      [GridLocation.EAST]: 1,
      [GridLocation.SOUTH]: 2,
      [GridLocation.WEST]: 3,
    };
    return locationToIndex[location] || 0;
  }

  boxShiftQuadrantIndex(location: GridLocation): number {
    /**
     * Get quadrant index for shift motions (PRO/ANTI/FLOAT) in box grid.
     */
    const locationToIndex: Partial<Record<GridLocation, number>> = {
      [GridLocation.NORTH]: 0,
      [GridLocation.EAST]: 1,
      [GridLocation.SOUTH]: 2,
      [GridLocation.WEST]: 3,
    };
    return locationToIndex[location] || 0;
  }

  boxStaticDashQuadrantIndex(location: GridLocation): number {
    /**
     * Get quadrant index for static/dash motions in box grid.
     */
    const locationToIndex: Partial<Record<GridLocation, number>> = {
      [GridLocation.NORTHEAST]: 0,
      [GridLocation.SOUTHEAST]: 1,
      [GridLocation.SOUTHWEST]: 2,
      [GridLocation.NORTHWEST]: 3,
    };
    return locationToIndex[location] || 0;
  }

  getQuadrantMapping(
    _gridMode: GridMode,
    motionType: MotionType
  ): Record<GridLocation, number> {
    /**
     * Get quadrant mapping for specific grid mode and motion type
     */
    const mapping: Partial<Record<GridLocation, number>> = {};

    // Get all possible locations
    const locations = [
      GridLocation.NORTHEAST,
      GridLocation.SOUTHEAST,
      GridLocation.SOUTHWEST,
      GridLocation.NORTHWEST,
    ];

    // Calculate quadrant index for each location
    for (const location of locations) {
      const motion = { motionType } as MotionData;
      mapping[location] = this.calculateQuadrantIndex(motion, location);
    }

    return mapping as Record<GridLocation, number>;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of container.items.arrowQuadrantCalculator to avoid DI container rebuilds.
// ============================================================================

export const arrowQuadrantCalculator = new ArrowQuadrantCalculator();
