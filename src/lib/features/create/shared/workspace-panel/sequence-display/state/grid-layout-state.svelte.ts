/**
 * Grid Layout State Factory
 *
 * Svelte 5 runes-based state management for responsive grid layout calculations.
 * Handles column count, row count, and cell sizing based on container dimensions.
 */

import type { IDeviceDetector } from "$lib/shared/device/services/contracts/IDeviceDetector";
import { getBeatFrameLayout } from "../domain/models/step-frame-layouts";
import type {
  GridLayout,
  GridSizingConstraints,
} from "../domain/models/step-grid-display-models";
import { DEFAULT_GRID_SIZING } from "../domain/models/step-grid-display-models";

/**
 * Create grid layout state with responsive calculations
 */
export function createGridLayoutState(
  deviceDetector: IDeviceDetector | null,
  isSideBySideLayout: () => boolean = () => false
) {
  // Container dimensions (reactive)
  let containerWidth = $state(0);
  let containerHeight = $state(0);

  // Sizing constraints (can be configured)
  let sizingConstraints = $state<GridSizingConstraints>({
    ...DEFAULT_GRID_SIZING,
  } as GridSizingConstraints);

  /**
   * Calculate responsive grid layout
   */
  const gridLayout = $derived.by((): GridLayout => {
    // If no device detector or no container size, return defaults
    if (!deviceDetector || containerWidth === 0 || containerHeight === 0) {
      return {
        rows: 1,
        columns: 4,
        totalColumns: 5, // +1 for start position
        cellSize: 160,
        maxColumns: 4,
      };
    }

    // Determine max columns based on layout mode
    // Side-by-side layout: ALWAYS 4 columns (ignores container width)
    // Top-and-bottom layout: Width-based threshold (8 or 4 columns based on 652px breakpoint)
    let maxColumns: number;
    if (isSideBySideLayout()) {
      // Side-by-side layout: Always 4 columns regardless of width
      maxColumns = 4;
    } else {
      // Top-and-bottom layout: Use width-based threshold
      // 652px threshold determines whether to use 8 or 4 columns
      maxColumns = containerWidth >= 650 ? 8 : 4;
    }

    return {
      rows: 0, // Will be calculated when beat count is known
      columns: 0, // Will be calculated when beat count is known
      totalColumns: maxColumns + 1, // +1 for start position
      cellSize: 160, // Default, will be calculated
      maxColumns,
    };
  });

  /**
   * Calculate layout for specific beat count
   * Uses beat frame layout configurations that adapt to screen width
   */
  function calculateLayoutForBeats(stepCount: number): GridLayout {
    // Determine if we should use wide layout
    // Side-by-side layout: Always use narrow layout (ignore width)
    // Top-and-bottom layout: Use width to determine narrow vs wide (652px threshold)
    const useWideLayout = !isSideBySideLayout() && containerWidth >= 650;

    // Get the optimal layout from configuration
    const optimalLayout = getBeatFrameLayout(stepCount, useWideLayout);

    // Use the configured layout
    const columns = optimalLayout.columns;
    const rows = optimalLayout.rows;
    const totalColumns = columns + 1; // +1 for start position
    const maxColumns = gridLayout.maxColumns;

    // Calculate responsive cell size considering both width and height
    let cellSize = 160; // Default

    if (containerWidth > 0 && containerHeight > 0) {
      // Use padding ratios from constraints
      const maxCellWidth =
        (containerWidth * sizingConstraints.widthPaddingRatio) / totalColumns;

      // For grids with threshold rows or fewer, consider height
      // For larger grids, prioritize width since scrolling is inevitable
      if (rows <= sizingConstraints.heightSizingRowThreshold) {
        const maxCellHeight =
          (containerHeight * sizingConstraints.heightPaddingRatio) / rows;
        // Use the smaller dimension to ensure the entire grid fits
        cellSize = Math.max(
          sizingConstraints.minCellSize,
          Math.min(
            sizingConstraints.maxCellSize,
            Math.floor(Math.min(maxCellWidth, maxCellHeight))
          )
        );
      } else {
        // For larger grids, prioritize width-based sizing
        cellSize = Math.max(
          sizingConstraints.minCellSize,
          Math.min(sizingConstraints.maxCellSize, Math.floor(maxCellWidth))
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
  function calculateBeatPosition(
    stepIndex: number,
    layout: GridLayout
  ): { row: number; column: number } {
    const row = Math.floor(stepIndex / layout.columns) + 1;
    const column = (stepIndex % layout.columns) + 2; // +2 because start position is column 1
    return { row, column };
  }

  /**
   * Update container dimensions
   */
  function setContainerSize(width: number, height: number) {
    containerWidth = width;
    containerHeight = height;
  }

  /**
   * Update sizing constraints
   */
  function setSizingConstraints(constraints: Partial<GridSizingConstraints>) {
    sizingConstraints = { ...sizingConstraints, ...constraints };
  }

  return {
    // Getters for reactive state
    get containerWidth() {
      return containerWidth;
    },
    get containerHeight() {
      return containerHeight;
    },
    get gridLayout() {
      return gridLayout;
    },
    get sizingConstraints() {
      return sizingConstraints;
    },

    // Actions
    setContainerSize,
    setSizingConstraints,
    calculateLayoutForBeats,
    calculateBeatPosition,
  };
}

export type GridLayoutState = ReturnType<typeof createGridLayoutState>;
