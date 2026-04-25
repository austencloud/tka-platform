
/**
 * Arrow Location Service
 *
 * Determines arrow location based on start and end positions using the same logic
 * as the desktop app's ShiftLocationCalculator.
 *
 * REFACTORED: Converted from utils to proper service with interface.
 */
import type {
  ArrowLocationInput,
  IArrowLocator,
} from "../contracts/IArrowLocator";

export class ArrowLocator implements IArrowLocator {
  /**
   * Calculate arrow location based on start and end positions
   */
  calculateArrowLocation(input: ArrowLocationInput): string {
    const { startLocation, endLocation, motionType } = input;

    // Return empty string if motion state is not initialized
    if (!startLocation || !endLocation) {
      return "";
    }

    // For PRO, ANTI, FLOAT - use shift location calculation
    if (["pro", "anti", "float"].includes(motionType)) {
      return this.calculateShiftLocation(startLocation, endLocation);
    }

    // For other types (DASH, STATIC), return start location
    return startLocation;
  }

  /**
   * Calculate shift location for directional movements
   */
  private calculateShiftLocation(
    startLocation: string,
    endLocation: string
  ): string {
    const directionPairs: Record<string, string> = {
      // Diagonal combinations
      "n,e": "ne",
      "e,n": "ne",
      "e,s": "se",
      "s,e": "se",
      "s,w": "sw",
      "w,s": "sw",
      "w,n": "nw",
      "n,w": "nw",

      // Corner to cardinal combinations
      "ne,nw": "n",
      "nw,ne": "n",
      "ne,se": "e",
      "se,ne": "e",
      "sw,se": "s",
      "se,sw": "s",
      "nw,sw": "w",
      "sw,nw": "w",
    };

    const key1 = `${startLocation},${endLocation}`;
    const key2 = `${endLocation},${startLocation}`;

    return directionPairs[key1] || directionPairs[key2] || "";
  }
}

// Legacy export functions for backward compatibility
export function calculateArrowLocation(input: ArrowLocationInput): string {
  const service = new ArrowLocator();
  return service.calculateArrowLocation(input);
}

// Constants matching the desktop app
export const LOCATIONS = {
  NORTH: "n",
  EAST: "e",
  SOUTH: "s",
  WEST: "w",
  NORTHEAST: "ne",
  SOUTHEAST: "se",
  SOUTHWEST: "sw",
  NORTHWEST: "nw",
} as const;

export const MOTION_TYPES = {
  PRO: "pro",
  ANTI: "anti",
  FLOAT: "float",
  DASH: "dash",
  STATIC: "static",
} as const;

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of arrowLocator to avoid DI container rebuilds.
// ============================================================================

export const arrowLocator = new ArrowLocator();
