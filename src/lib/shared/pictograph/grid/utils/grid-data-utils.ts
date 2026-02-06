/**
 * Grid Domain Model
 *
 * Immutable data for the pictograph grid system.
 * Based on modern desktop app's gridData.py
 */

import { GridMode } from "../domain/enums/grid-enums";
import type { GridData } from "../domain/models/grid-models";

export function createGridData(data: Partial<GridData> = {}): GridData {
  return {
    gridMode: data["gridMode"] ?? GridMode.DIAMOND,
    centerX: data["centerX"] ?? 0.0,
    centerY: data["centerY"] ?? 0.0,
    radius: data["radius"] ?? 100.0,
    gridPointData: data.gridPointData ?? {
      allHandPointsStrict: {},
      allHandPointsNormal: {},
      allLayer2PointsStrict: {},
      allLayer2PointsNormal: {},
      allOuterPoints: {},
      centerPoint: { coordinates: { x: 0, y: 0 } },
    },
  };
}

export function updateGridData(
  grid: GridData,
  updates: Partial<GridData>
): GridData {
  return {
    ...grid,
    ...updates,
  };
}

export function gridDataToObject(grid: GridData): Record<string, unknown> {
  return {
    gridMode: grid["gridMode"],
    centerX: grid["centerX"],
    centerY: grid["centerY"],
    radius: grid["radius"],
    gridPoints: grid.gridPointData,
  };
}

export function gridDataFromObject(data: Record<string, unknown>): GridData {
  const gridData: Record<string, unknown> = {};

  if (data["gridMode"] !== undefined) {
    gridData["gridMode"] = data["gridMode"];
  }
  if (data["centerX"] !== undefined) {
    gridData["centerX"] = data["centerX"];
  }
  if (data["centerY"] !== undefined) {
    gridData["centerY"] = data["centerY"];
  }
  if (data["radius"] !== undefined) {
    gridData["radius"] = data["radius"];
  }
  if (data["gridPoints"] !== undefined) {
    gridData["gridPoints"] = data["gridPoints"];
  }

  return createGridData(gridData as Partial<GridData>);
}

// Canvas-based grid drawing options (for BeatGridService)
