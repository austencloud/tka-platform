import { GridLocation, GridMode } from "@tka/types";
import type { GridPointData } from "../../../domain/grid-models";
import { createGridPointData } from "../../../utils/grid-coordinate-utils";

const CARDINAL_LOCATIONS = new Set(["n", "e", "s", "w"]);

/**
 * Calculates default prop positions using grid coordinates.
 * Ported from legacy web app to ensure positioning parity.
 */
export class DefaultPropPositioner {
  private fallbackCoordinates: Record<string, { x: number; y: number }> = {
    n: { x: 475, y: 331.9 },
    e: { x: 618.1, y: 475 },
    s: { x: 475, y: 618.1 },
    w: { x: 331.9, y: 475 },
    ne: { x: 576.2, y: 373.8 },
    se: { x: 576.2, y: 576.2 },
    sw: { x: 373.8, y: 576.2 },
    nw: { x: 373.8, y: 373.8 },
  };

  constructor(
    private gridData: GridPointData,
    private gridMode: GridMode
  ) {
    if (!gridData.allHandPointsNormal) {
      throw new Error("Invalid grid data provided to DefaultPropPositioner");
    }
  }

  public calculateCoordinates(location: GridLocation | string): {
    x: number;
    y: number;
  } {
    const normalizedLocation = (
      typeof location === "string" ? location : location
    ).toLowerCase();

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
      return this.getFallbackCoordinates(normalizedLocation);
    }
  }

  private getGridPoint(
    pointName: string
  ): { coordinates: { x: number; y: number } } | null {
    if (this.gridData.allHandPointsNormal[pointName]) {
      const point = this.gridData.allHandPointsNormal[pointName];
      if (point.coordinates) {
        return { coordinates: point.coordinates };
      }
    }

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

  private getFallbackCoordinates(location: string): { x: number; y: number } {
    return this.fallbackCoordinates[location] || { x: 475, y: 475 };
  }

  static calculatePosition(
    location: GridLocation,
    gridMode: GridMode
  ): { x: number; y: number } {
    try {
      const gridPointData = createGridPointData(gridMode);
      const positioner = new DefaultPropPositioner(gridPointData, gridMode);
      return positioner.calculateCoordinates(location);
    } catch (error) {
      console.error("Error calculating position:", error);
      return { x: 475, y: 475 };
    }
  }
}
