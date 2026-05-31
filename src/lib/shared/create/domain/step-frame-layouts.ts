/**
 * Beat Frame Layout Configuration
 *
 * Defines the optimal grid layout (rows, columns) for different beat counts.
 * Based on desktop app configuration for consistent UX across platforms.
 *
 * Format: [rows, columns] for each beat count
 * These layouts are optimized for visual balance and readability.
 */

export interface StepFrameLayout {
  rows: number;
  columns: number;
}

/**
 * Desktop-aligned beat frame layouts - NARROW/STANDARD
 * Used for: Side-by-side layout OR narrow portrait (< 652px)
 * Source: desktop/data/beat_frame_layouts.py
 * Format: Desktop stores as (rows, columns) tuples
 *
 * Key patterns:
 * - Small counts (1-4): Single row, expanding columns
 * - Medium counts (5-20): Multiple columns, typically 2-4 columns
 * - 12 steps: Special case - 4 columns x 3 rows for optimal viewing
 * - Large counts (21+): 4 columns, expanding rows
 */
export const STEP_FRAME_LAYOUTS: Record<number, StepFrameLayout> = {
  0: { rows: 0, columns: 1 }, // Desktop: (0, 1)
  1: { rows: 1, columns: 1 }, // Desktop: (1, 1)
  2: { rows: 1, columns: 2 }, // Desktop: (2, 1) -> 1 row, 2 columns
  3: { rows: 1, columns: 3 }, // Desktop: (3, 1) -> 1 row, 3 columns
  4: { rows: 2, columns: 2 }, // 2x2 square: desktop side-by-side + narrow phones read better square than a 4-wide strip. Wide stacked (Z Fold) keeps 4 via BEAT_FRAME_LAYOUTS_WIDE.
  5: { rows: 2, columns: 4 }, // Desktop: (3, 2) -> 2 rows, 3 columns
  6: { rows: 2, columns: 4 }, // Desktop: (3, 2)
  7: { rows: 2, columns: 4 }, // Desktop: (4, 2) -> 2 rows, 4 columns
  8: { rows: 2, columns: 4 }, // Desktop: (4, 2)
  9: { rows: 3, columns: 4 }, // Desktop: (3, 3) -> 3 rows, 3 columns
  10: { rows: 2, columns: 4 }, // Desktop: (5, 2) -> 2 rows, 5 columns
  11: { rows: 4, columns: 4 }, // Desktop: (3, 4) -> 4 rows, 3 columns
  12: { rows: 4, columns: 4 }, // Desktop: (3, 4) -> 4 rows, 3 columns - KEY: 12 steps = 3 cols!
  13: { rows: 4, columns: 4 }, // Desktop: (4, 4) -> 4 rows, 4 columns
  14: { rows: 4, columns: 4 }, // Desktop: (4, 4)
  15: { rows: 4, columns: 4 }, // Desktop: (4, 4)
  16: { rows: 4, columns: 4 }, // Desktop: (4, 4)
  17: { rows: 4, columns: 5 }, // Desktop: (5, 4) -> 4 rows, 5 columns
  18: { rows: 4, columns: 5 }, // Desktop: (5, 4)
  19: { rows: 4, columns: 5 }, // Desktop: (5, 4)
  20: { rows: 4, columns: 5 }, // Desktop: (5, 4)
  21: { rows: 6, columns: 4 }, // Desktop: (4, 6) -> 6 rows, 4 columns
  22: { rows: 6, columns: 4 }, // Desktop: (4, 6)
  23: { rows: 6, columns: 4 }, // Desktop: (4, 6)
  24: { rows: 6, columns: 4 }, // Desktop: (4, 6)
  25: { rows: 7, columns: 4 }, // Desktop: (4, 7) -> 7 rows, 4 columns
  26: { rows: 7, columns: 4 }, // Desktop: (4, 7)
  27: { rows: 7, columns: 4 }, // Desktop: (4, 7)
  28: { rows: 7, columns: 4 }, // Desktop: (4, 7)
  29: { rows: 8, columns: 4 }, // Desktop: (4, 8) -> 8 rows, 4 columns
  30: { rows: 8, columns: 4 }, // Desktop: (4, 8)
  31: { rows: 8, columns: 4 }, // Desktop: (4, 8)
  32: { rows: 8, columns: 4 }, // Desktop: (4, 8)
  33: { rows: 9, columns: 4 }, // Desktop: (4, 9) -> 9 rows, 4 columns
  34: { rows: 9, columns: 4 }, // Desktop: (4, 9)
  35: { rows: 9, columns: 4 }, // Desktop: (4, 9)
  36: { rows: 9, columns: 4 }, // Desktop: (4, 9)
  37: { rows: 10, columns: 4 }, // Desktop: (4, 10) -> 10 rows, 4 columns
  38: { rows: 10, columns: 4 }, // Desktop: (4, 10)
  39: { rows: 10, columns: 4 }, // Desktop: (4, 10)
  40: { rows: 10, columns: 4 }, // Desktop: (4, 10)
  41: { rows: 11, columns: 4 }, // Desktop: (4, 11) -> 11 rows, 4 columns
  42: { rows: 11, columns: 4 }, // Desktop: (4, 11)
  43: { rows: 11, columns: 4 }, // Desktop: (4, 11)
  44: { rows: 11, columns: 4 }, // Desktop: (4, 11)
  45: { rows: 12, columns: 4 }, // Desktop: (4, 12) -> 12 rows, 4 columns
  46: { rows: 12, columns: 4 }, // Desktop: (4, 12)
  47: { rows: 12, columns: 4 }, // Desktop: (4, 12)
  48: { rows: 12, columns: 4 }, // Desktop: (4, 12)
  49: { rows: 13, columns: 4 }, // Desktop: (4, 13) -> 13 rows, 4 columns
  50: { rows: 13, columns: 4 }, // Desktop: (4, 13)
  51: { rows: 13, columns: 4 }, // Desktop: (4, 13)
  52: { rows: 13, columns: 4 }, // Desktop: (4, 13)
  53: { rows: 14, columns: 4 }, // Desktop: (4, 14) -> 14 rows, 4 columns
  54: { rows: 14, columns: 4 }, // Desktop: (4, 14)
  55: { rows: 14, columns: 4 }, // Desktop: (4, 14)
  56: { rows: 14, columns: 4 }, // Desktop: (4, 14)
  57: { rows: 15, columns: 4 }, // Desktop: (4, 15) -> 15 rows, 4 columns
  58: { rows: 15, columns: 4 }, // Desktop: (4, 15)
  59: { rows: 15, columns: 4 }, // Desktop: (4, 15)
  60: { rows: 15, columns: 4 }, // Desktop: (4, 15)
  61: { rows: 16, columns: 4 }, // Desktop: (4, 16) -> 16 rows, 4 columns
  62: { rows: 16, columns: 4 }, // Desktop: (4, 16)
  63: { rows: 16, columns: 4 }, // Desktop: (4, 16)
  64: { rows: 16, columns: 4 }, // Desktop: (4, 16)
};

/**
 * Wide portrait mode beat frame layouts - WIDE
 * Used for: Wide portrait layout (≥ 652px in stacked mode)
 * Takes advantage of horizontal space with up to 8 columns
 *
 * Strategy: Use more columns to spread steps horizontally, fewer rows
 * This matches OptionPicker behavior in wide portrait mode
 */
export const BEAT_FRAME_LAYOUTS_WIDE: Record<number, StepFrameLayout> = {
  0: { rows: 0, columns: 1 }, // Desktop: (0, 1)
  1: { rows: 1, columns: 1 }, // Desktop: (1, 1)
  2: { rows: 1, columns: 2 }, // Desktop: (2, 1) -> 1 row, 2 columns
  3: { rows: 1, columns: 3 }, // Desktop: (3, 1) -> 1 row, 3 columns
  4: { rows: 1, columns: 4 }, // Desktop: (4, 1) -> 1 row, 4 columns
  5: { rows: 2, columns: 4 }, // Desktop: (3, 2) -> 2 rows, 3 columns
  6: { rows: 2, columns: 4 }, // Desktop: (3, 2)
  7: { rows: 2, columns: 4 }, // Desktop: (4, 2) -> 2 rows, 4 columns
  8: { rows: 2, columns: 4 }, // Full width: 1 row x 8 columns
  9: { rows: 2, columns: 8 }, // Wide spread: 2 rows x 8 columns (9 steps: 5+4)
  10: { rows: 2, columns: 8 }, // Even split: 2 rows x 8 columns
  11: { rows: 2, columns: 8 }, // Wide spread: 2 rows x 8 columns (11 steps: 6+5)
  12: { rows: 2, columns: 8 }, // Even split: 2 rows x 8 columns
  13: { rows: 2, columns: 8 }, // Wide spread: 2 rows x 8 columns (13 steps: 7+6)
  14: { rows: 2, columns: 8 }, // Even split: 2 rows x 8 columns
  15: { rows: 2, columns: 8 }, // Wide spread: 2 rows x 8 columns (15 steps: 8+7)
  16: { rows: 2, columns: 8 }, // Full width: 2 rows x 8 columns
  17: { rows: 3, columns: 8 }, // 3 rows x 8 columns (17 steps: 6+6+5)
  18: { rows: 3, columns: 8 }, // Even spread: 3 rows x 8 columns
  19: { rows: 3, columns: 8 }, // 3 rows x 8 columns (19 steps: 8+6+5)
  20: { rows: 3, columns: 8 }, // 3 rows x 8 columns (20 steps: 8+7+5)
  21: { rows: 3, columns: 8 }, // 3 rows x 8 columns
  22: { rows: 3, columns: 8 }, // 3 rows x 8 columns (22 steps: 8+7+7)
  23: { rows: 3, columns: 8 }, // 3 rows x 8 columns (23 steps: 8+8+7)
  24: { rows: 3, columns: 8 }, // Full width: 3 rows x 8 columns
  25: { rows: 4, columns: 8 }, // 4 rows x 8 columns (25 steps: 8+6+6+5)
  26: { rows: 4, columns: 8 }, // 4 rows x 8 columns (26 steps: 8+7+6+5)
  27: { rows: 4, columns: 8 }, // 4 rows x 8 columns (27 steps: 8+7+6+6)
  28: { rows: 4, columns: 8 }, // Even spread: 4 rows x 8 columns
  29: { rows: 4, columns: 8 }, // 4 rows x 8 columns (29 steps: 8+7+7+7)
  30: { rows: 4, columns: 8 }, // 4 rows x 8 columns (30 steps: 8+8+7+7)
  31: { rows: 4, columns: 8 }, // 4 rows x 8 columns (31 steps: 8+8+8+7)
  32: { rows: 4, columns: 8 }, // Full width: 4 rows x 8 columns
  33: { rows: 5, columns: 8 }, // 5 rows x 8 columns
  34: { rows: 5, columns: 8 }, // 5 rows x 8 columns
  35: { rows: 5, columns: 8 }, // 5 rows x 8 columns
  36: { rows: 5, columns: 8 }, // 5 rows x 8 columns (36 steps: 8+8+7+7+6)
  37: { rows: 5, columns: 8 }, // 5 rows x 8 columns
  38: { rows: 5, columns: 8 }, // 5 rows x 8 columns
  39: { rows: 5, columns: 8 }, // 5 rows x 8 columns
  40: { rows: 5, columns: 8 }, // Full width: 5 rows x 8 columns
  41: { rows: 6, columns: 8 }, // 6 rows x 8 columns
  42: { rows: 6, columns: 8 }, // 6 rows x 8 columns
  43: { rows: 6, columns: 8 }, // 6 rows x 8 columns
  44: { rows: 6, columns: 8 }, // 6 rows x 8 columns
  45: { rows: 6, columns: 8 }, // 6 rows x 8 columns
  46: { rows: 6, columns: 8 }, // 6 rows x 8 columns
  47: { rows: 6, columns: 8 }, // 6 rows x 8 columns
  48: { rows: 6, columns: 8 }, // Full width: 6 rows x 8 columns
  49: { rows: 7, columns: 8 }, // 7 rows x 8 columns
  50: { rows: 7, columns: 8 }, // 7 rows x 8 columns
  51: { rows: 7, columns: 8 }, // 7 rows x 8 columns
  52: { rows: 7, columns: 8 }, // 7 rows x 8 columns
  53: { rows: 7, columns: 8 }, // 7 rows x 8 columns
  54: { rows: 7, columns: 8 }, // 7 rows x 8 columns
  55: { rows: 7, columns: 8 }, // 7 rows x 8 columns
  56: { rows: 7, columns: 8 }, // Full width: 7 rows x 8 columns
  57: { rows: 8, columns: 8 }, // 8 rows x 8 columns
  58: { rows: 8, columns: 8 }, // 8 rows x 8 columns
  59: { rows: 8, columns: 8 }, // 8 rows x 8 columns
  60: { rows: 8, columns: 8 }, // 8 rows x 8 columns
  61: { rows: 8, columns: 8 }, // 8 rows x 8 columns
  62: { rows: 8, columns: 8 }, // 8 rows x 8 columns
  63: { rows: 8, columns: 8 }, // 8 rows x 8 columns
  64: { rows: 8, columns: 8 }, // Full width: 8 rows x 8 columns
};

/**
 * Get the optimal layout for a given beat count
 * Falls back to calculated layout for counts not in the table
 *
 * @param stepCount - Number of steps in the sequence
 * @param useWideLayout - Whether to use wide layout (≥652px in portrait mode)
 */
export function getStepFrameLayout(
  stepCount: number,
  useWideLayout: boolean = false
): StepFrameLayout {
  // Select the appropriate layout table
  const layoutTable = useWideLayout
    ? BEAT_FRAME_LAYOUTS_WIDE
    : STEP_FRAME_LAYOUTS;

  // Use predefined layout if available
  if (stepCount in layoutTable) {
    return layoutTable[stepCount]!;
  }

  // Fallback: Calculate layout for counts beyond table
  // Pattern for large counts: expanding columns based on layout mode
  if (useWideLayout) {
    // Wide layout: up to 8 columns, expanding rows
    const columns = Math.min(8, Math.ceil(stepCount / 8));
    const rows = Math.ceil(stepCount / columns);
    return { rows, columns };
  } else {
    // Narrow layout: 4 columns, expanding rows
    const columns = 4;
    const rows = Math.ceil(stepCount / columns);
    return { rows, columns };
  }
}

/**
 * Check if a beat count should use a narrow layout (fewer columns than default)
 * Useful for responsive adjustments
 *
 * @param stepCount - Number of steps in the sequence
 * @param useWideLayout - Whether to use wide layout
 */
export function shouldUseNarrowLayout(
  stepCount: number,
  useWideLayout: boolean = false
): boolean {
  const layout = getStepFrameLayout(stepCount, useWideLayout);
  return layout.columns <= 3;
}

/**
 * Get maximum columns for responsive layout calculations
 * Returns the column count that should be used for the given beat count,
 * respecting both the optimal layout and container width constraints
 *
 * @param stepCount - Number of steps in the sequence
 * @param isSideBySideLayout - Whether using side-by-side (horizontal) layout
 * @param containerWidth - Width of the container in pixels
 */
export function getMaxColumnsForBeatCount(
  stepCount: number,
  isSideBySideLayout: boolean,
  containerWidth: number = 0
): number {
  // Wide (8-col) layout only for stacked/portrait mode with wide containers
  // (e.g., Z Fold unfolded portrait). Side-by-side (desktop) always uses 4 columns
  // because the workspace shares horizontal space with the tool panel.
  const useWideLayout = !isSideBySideLayout && containerWidth >= 650;
  const optimalLayout = getStepFrameLayout(stepCount, useWideLayout);
  const maxCap = useWideLayout ? 8 : 4;
  return Math.min(optimalLayout.columns, maxCap);
}
