/**
 * Grid Calculation Utilities
 *
 * Pure functions for calculating grid layout dimensions and positions.
 * These are NOT reactive - they take inputs and return outputs.
 * The component's $derived will call these with reactive values.
 */

import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
import { getMaxColumnsForBeatCount } from "../domain/models/step-frame-layouts";

export interface GridLayout {
  rows: number;
  columns: number;
  totalColumns: number;
  cellSize: number;
  maxColumns: number;
}

export interface GridSizingConfig {
  minCellSize?: number;
  maxCellSize?: number;
  widthPaddingRatio?: number;
  heightPaddingRatio?: number;
  heightSizingRowThreshold?: number;
  columnBreakpoint?: number;
  isSideBySideLayout?: boolean;
  manualColumnCount?: number | null;
}

const DEFAULT_SIZING: Omit<Required<GridSizingConfig>, "manualColumnCount"> & {
  manualColumnCount: number | null;
} = {
  minCellSize: 40, // Reduced from 50px to allow fitting more rows on small screens
  maxCellSize: 200,
  widthPaddingRatio: 0.95,
  heightPaddingRatio: 0.92, // Conservative to account for all container padding and gaps
  heightSizingRowThreshold: 8, // Try to fit up to 8 rows (32 steps with 4 cols) before allowing scroll
  columnBreakpoint: 650,
  isSideBySideLayout: false,
  manualColumnCount: null,
};

/**
 * Calculate responsive grid layout
 */
export function calculateGridLayout(
  stepCount: number,
  containerWidth: number,
  containerHeight: number,
  _deviceDetector: IDeviceDetector | null,
  config: GridSizingConfig = {}
): GridLayout {
  // Filter out undefined values from config to prevent overriding defaults with undefined
  const filteredConfig = Object.fromEntries(
    Object.entries(config).filter(([_, v]) => v !== undefined)
  );
  const sizing = { ...DEFAULT_SIZING, ...filteredConfig };

  // Handle edge case: no steps (just start position)
  // This prevents division by zero and ensures proper single-cell sizing
  if (stepCount === 0) {
    // Single cell for start position only
    let cellSize = sizing.maxCellSize;

    if (containerWidth > 0 && containerHeight > 0) {
      // For a single cell, use the smaller dimension to fit within both width AND height
      const availableWidth = containerWidth * sizing.widthPaddingRatio;
      const availableHeight = containerHeight * sizing.heightPaddingRatio;
      cellSize = Math.max(
        sizing.minCellSize,
        Math.min(sizing.maxCellSize, Math.floor(Math.min(availableWidth, availableHeight)))
      );
    }

    return {
      rows: 1,
      columns: 1,
      totalColumns: 1, // Just the start position column
      cellSize,
      maxColumns: 1,
    };
  }

  // Determine columns: use manual override if provided, otherwise calculate automatically
  let maxColumns: number;
  let columns: number;

  if (sizing.manualColumnCount !== null && sizing.manualColumnCount > 0) {
    // Manual override: use the specified column count
    maxColumns = sizing.manualColumnCount;
    columns = Math.min(stepCount, sizing.manualColumnCount);
  } else {
    // Automatic: determine max columns based on layout mode and container width
    // Side-by-side layout: Always 4 columns max (ignores container width)
    // Top-and-bottom layout: Width-based (4 or 8 columns depending on width)
    maxColumns = getMaxColumnsForBeatCount(
      stepCount,
      sizing.isSideBySideLayout,
      containerWidth
    );

    // Calculate actual columns based on beat count and max columns
    // For small beat counts, use the optimal count; for larger counts, respect max columns
    columns = Math.min(stepCount, maxColumns);
  }

  const rows = Math.ceil(stepCount / columns);
  const totalColumns = columns + 1; // +1 for start position

  // Calculate responsive cell size considering both width and height
  let cellSize = 160; // Default

  if (containerWidth > 0 && containerHeight > 0) {
    // Grid gap between cells (must match CSS gap value in StepGrid.svelte)
    const gridGap = 1;

    // Scroll container padding (horizontal padding from beat-grid-scroll in StepGrid.svelte)
    const scrollContainerPadding = 8; // 4px on each side

    // Account for ALL spacing when calculating available space
    const totalWidthGaps = (totalColumns - 1) * gridGap;
    const totalHeightGaps = (rows - 1) * gridGap;

    // Calculate max cell size after subtracting gap space AND container padding
    const availableWidth =
      containerWidth * sizing.widthPaddingRatio -
      totalWidthGaps -
      scrollContainerPadding;
    const availableHeight =
      containerHeight * sizing.heightPaddingRatio -
      totalHeightGaps -
      scrollContainerPadding;

    const maxCellWidth = availableWidth / totalColumns;

    // For grids with threshold rows or fewer, consider height to prevent clipping
    // For larger grids, prioritize width since scrolling is inevitable
    if (rows <= sizing.heightSizingRowThreshold) {
      const maxCellHeight = availableHeight / rows;
      // Use the smaller dimension to ensure the entire grid fits
      cellSize = Math.max(
        sizing.minCellSize,
        Math.min(
          sizing.maxCellSize,
          Math.floor(Math.min(maxCellWidth, maxCellHeight))
        )
      );
    } else {
      // For larger grids, prioritize width-based sizing
      cellSize = Math.max(
        sizing.minCellSize,
        Math.min(sizing.maxCellSize, Math.floor(maxCellWidth))
      );
    }
  }

  return {
    rows,
    columns,
    totalColumns,
    cellSize,
    maxColumns,
  };
}

/**
 * Calculate grid position (row, column) for beat index
 */
export function calculateBeatPosition(
  stepIndex: number,
  columns: number
): { row: number; column: number } {
  const row = Math.floor(stepIndex / columns) + 1;
  const column = (stepIndex % columns) + 2; // +2 because start position is column 1
  return { row, column };
}
