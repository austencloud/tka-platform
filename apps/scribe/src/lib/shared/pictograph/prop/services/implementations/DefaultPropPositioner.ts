import {
  GridLocation,
  GridMode,
} from "../../../grid/domain/enums/grid-enums";
import type { GridPointData } from "../../../grid/domain/models/grid-models";
import { createGridPointData } from "../../../grid/utils/grid-coordinate-utils";

// Cardinal locations use diamond grid coordinates
const CARDINAL_LOCATIONS = new Set(["n", "e", "s", "w"]);
// Intercardinal locations use box grid coordinates
const INTERCARDINAL_LOCATIONS = new Set(["ne", "se", "sw", "nw"]);

/**
 * DefaultPropPositioner - Calculates default prop positions using grid coordinates
 * Ported from legacy web app to ensure positioning parity
 */
export class DefaultPropPositioner {
  // Fallback coordinates matching actual grid data
  private fallbackCoordinates: Record<string, { x: number; y: number }> = {
    // Diamond mode (cardinal) - from gridCoordinates
    n: { x: 475, y: 331.9 },
    e: { x: 618.1, y: 475 },
    s: { x: 475, y: 618.1 },
    w: { x: 331.9, y: 475 },
    // Box mode (intercardinal) - from gridCoordinates
    ne: { x: 576.2, y: 373.8 },
    se: { x: 576.2, y: 576.2 },
    sw: { x: 373.8, y: 576.2 },
    nw: { x: 373.8, y: 373.8 },
  };

  constructor(
    private gridData: GridPointData,
    private gridMode: GridMode
  ) {
    // Validate grid data on initialization
    if (!gridData.allHandPointsNormal) {
      throw new Error("Invalid grid data provided to DefaultPropPositioner");
    }
  }

  /**
   * Calculate coordinates for a prop based on its location
   */
  public calculateCoordinates(location: GridLocation | string): {
    x: number;
    y: number;
  } {
    // Normalize location to lowercase to match grid coordinate keys
    const normalizedLocation = (
      typeof location === "string" ? location : location
    ).toLowerCase();

    // For SKEWED mode, determine the correct grid type based on location:
    // - Cardinal (N, E, S, W) → diamond grid
    // - Intercardinal (NE, SE, SW, NW) → box grid
    let gridType: string;
    if (this.gridMode === GridMode.SKEWED) {
      gridType = CARDINAL_LOCATIONS.has(normalizedLocation) ? "diamond" : "box";
    } else {
      gridType = this.gridMode.valueOf();
    }

    const pointName = `${normalizedLocation}_${gridType}_hand_point`;
    const gridPoint = this.getGridPoint(pointName);

    if (gridPoint?.coordinates) {
      return gridPoint.coordinates;
    } else {
      const fallback = this.getFallbackCoordinates(normalizedLocation);
      return fallback;
    }
  }

  /**
   * Get grid point by name from grid data
   */
  private getGridPoint(
    pointName: string
  ): { coordinates: { x: number; y: number } } | null {
    // Try to find the point in allHandPointsNormal
    if (this.gridData.allHandPointsNormal[pointName]) {
      const point = this.gridData.allHandPointsNormal[pointName];
      if (point.coordinates) {
        return { coordinates: point.coordinates };
      }
    }

    // Try alternative naming patterns
    const alternativeNames = [
      pointName,
      pointName.replace("_hand_point", ""),
      `${pointName}_normal`,
      `hand_${pointName}`,
    ];

    for (const altName of alternativeNames) {
      if (this.gridData.allHandPointsNormal[altName]) {
        const point = this.gridData.allHandPointsNormal[altName];
        if (point.coordinates) {
          return { coordinates: point.coordinates };
        }
      }
    }

    return null;
  }

  /**
   * Get fallback coordinates for a location
   */
  private getFallbackCoordinates(location: string): { x: number; y: number } {
    return this.fallbackCoordinates[location] || { x: 475, y: 475 }; // Center fallback
  }

  /**
   * Static helper method for quick coordinate calculation
   */
  static calculatePosition(
    location: GridLocation,
    gridMode: GridMode
  ): { x: number; y: number } {
    try {
      const gridPointData = createGridPointData(gridMode);
      const positioner = new DefaultPropPositioner(gridPointData, gridMode);
      const result = positioner.calculateCoordinates(location);
      return result;
    } catch (error) {
      console.error("Error calculating position:", error);
      // Return center as ultimate fallback
      return { x: 475, y: 475 };
    }
  }
}

export default DefaultPropPositioner;
