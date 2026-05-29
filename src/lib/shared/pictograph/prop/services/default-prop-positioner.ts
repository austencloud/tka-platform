import type {
  GridLocation} from "../../grid/domain/enums/grid-enums";
import {
  GridMode,
} from "../../grid/domain/enums/grid-enums";
import type { GridPointData } from "../../grid/domain/models/grid-models";
import { createGridPointData } from "../../grid/utils/grid-coordinate-utils";

// Cardinal locations use diamond grid coordinates
const CARDINAL_LOCATIONS = new Set(["n", "e", "s", "w"]);
// Intercardinal locations use box grid coordinates
const _INTERCARDINAL_LOCATIONS = new Set(["ne", "se", "sw", "nw"]);

/**
 * DefaultPropPositioner - Calculates default prop positions using grid coordinates
 * Ported from legacy web app to ensure positioning parity
 *
 * Supports two handpoint sets:
 * - Normal: default positioning for most props
 * - Strict: further from center, used for large props (bighoop, bigdoublestar, etc.)
 *
 * From desktop: legacy/src/placement_managers/prop_placement_manager/handlers/default_prop_positioner.py
 */
export class DefaultPropPositioner {
  // Fallback coordinates matching actual grid data (normal)
  private static fallbackNormal: Record<string, { x: number; y: number }> = {
    n: { x: 475, y: 331.9 },
    e: { x: 618.1, y: 475 },
    s: { x: 475, y: 618.1 },
    w: { x: 331.9, y: 475 },
    ne: { x: 576.2, y: 373.8 },
    se: { x: 576.2, y: 576.2 },
    sw: { x: 373.8, y: 576.2 },
    nw: { x: 373.8, y: 373.8 },
    c: { x: 475, y: 475 },
  };

  // Fallback coordinates for strict handpoints (further from center)
  private static fallbackStrict: Record<string, { x: number; y: number }> = {
    n: { x: 475, y: 325 },
    e: { x: 625, y: 475 },
    s: { x: 475, y: 625 },
    w: { x: 325, y: 475 },
    ne: { x: 581.1, y: 368.9 },
    se: { x: 581.1, y: 581.1 },
    sw: { x: 368.9, y: 581.1 },
    nw: { x: 368.9, y: 368.9 },
    c: { x: 475, y: 475 },
  };

  constructor(
    private gridData: GridPointData,
    private gridMode: GridMode
  ) {
    if (!gridData.allHandPointsNormal) {
      throw new Error("Invalid grid data provided to DefaultPropPositioner");
    }
  }

  /**
   * Calculate coordinates for a prop based on its location
   * @param useStrict - When true, uses strict handpoints (further from center)
   */
  public calculateCoordinates(
    location: GridLocation | string,
    useStrict = false
  ): {
    x: number;
    y: number;
  } {
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

    // Legacy: point_name = f"{loc}_{grid_mode}_hand_point{_strict if strict else ''}"
    const suffix = useStrict ? "_strict" : "";
    const pointName = `${normalizedLocation}_${gridType}_hand_point${suffix}`;
    const gridPoint = this.getGridPoint(pointName, useStrict);

    if (gridPoint?.coordinates) {
      return gridPoint.coordinates;
    } else {
      const fallbacks = useStrict
        ? DefaultPropPositioner.fallbackStrict
        : DefaultPropPositioner.fallbackNormal;
      return fallbacks[normalizedLocation] || { x: 475, y: 475 };
    }
  }

  /**
   * Get grid point by name from grid data
   */
  private getGridPoint(
    pointName: string,
    useStrict: boolean
  ): { coordinates: { x: number; y: number } } | null {
    const handPoints = useStrict
      ? this.gridData.allHandPointsStrict
      : this.gridData.allHandPointsNormal;

    if (handPoints[pointName]) {
      const point = handPoints[pointName];
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
      if (handPoints[altName]) {
        const point = handPoints[altName];
        if (point.coordinates) {
          return { coordinates: point.coordinates };
        }
      }
    }

    return null;
  }

  /**
   * Static helper method for quick coordinate calculation
   * @param useStrict - When true, uses strict handpoints for large props
   */
  static calculatePosition(
    location: GridLocation,
    gridMode: GridMode,
    useStrict = false
  ): { x: number; y: number } {
    try {
      const gridPointData = createGridPointData(gridMode);
      const positioner = new DefaultPropPositioner(gridPointData, gridMode);
      const result = positioner.calculateCoordinates(location, useStrict);
      return result;
    } catch (error) {
      console.error("Error calculating position:", error);
      return { x: 475, y: 475 };
    }
  }
}

export default DefaultPropPositioner;
