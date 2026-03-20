/**
 * Layout Calculation Service
 *
 * Provides pixel-perfect layout calculations matching the desktop application.
 * This service implements the exact same layout tables and algorithms used in
 * the desktop ImageExportLayoutHandler.
 *
 * Critical: All layout tables are copied exactly from the desktop version to
 * ensure identical image dimensions and beat positioning.
 */

import type { ILayoutCalculator } from "../contracts/ILayoutCalculator";

export class LayoutCalculator implements ILayoutCalculator {
  // Base constants matching desktop application
  private static readonly BASE_BEAT_SIZE = 144; // Match desktop beat.width()

  /**
   * Layout table for sequences WITH start position
   * Copied exactly from desktop get_layout_options_with_start()
   * Format: stepCount -> [columns, rows]
   */
  private readonly LAYOUT_WITH_START_POSITION: Record<
    number,
    [number, number]
  > = {
    0: [1, 1],
    1: [2, 1],
    2: [3, 1],
    3: [4, 1],
    4: [3, 2],
    5: [3, 2],
    6: [4, 2],
    7: [5, 2],
    8: [5, 2],
    9: [5, 3],
    10: [6, 2],
    11: [5, 3],
    12: [4, 4],
    13: [5, 4],
    14: [5, 4],
    15: [5, 4],
    16: [5, 4],
    17: [5, 5],
    18: [5, 5],
    19: [5, 5],
    20: [6, 4],
    21: [5, 6],
    22: [5, 6],
    23: [5, 6],
    24: [7, 4],
    25: [5, 7],
    26: [5, 7],
    27: [5, 7],
    28: [5, 7],
    29: [5, 8],
    30: [8, 4],
    31: [5, 8],
    32: [9, 4],
    33: [5, 9],
    34: [5, 9],
    35: [5, 9],
    36: [10, 4],
    37: [5, 10],
    38: [5, 10],
    39: [5, 10],
    40: [11, 4],
    41: [5, 11],
    42: [5, 11],
    43: [5, 11],
    44: [5, 11],
    45: [5, 12],
    46: [5, 12],
    47: [5, 12],
    48: [5, 12],
    49: [5, 13],
    50: [5, 13],
    51: [5, 13],
    52: [5, 13],
    53: [5, 14],
    54: [5, 14],
    55: [5, 14],
    56: [5, 14],
    57: [5, 15],
    58: [5, 15],
    59: [5, 15],
    60: [5, 15],
    61: [5, 16],
    62: [5, 16],
    63: [5, 16],
    64: [5, 16],
  };

  /**
   * Layout table for sequences WITHOUT start position
   * Copied exactly from desktop get_layout_options_without_start()
   * Format: stepCount -> [columns, rows]
   */
  private readonly LAYOUT_WITHOUT_START_POSITION: Record<
    number,
    [number, number]
  > = {
    0: [1, 1],
    1: [1, 1],
    2: [2, 1],
    3: [3, 1],
    4: [2, 2],
    5: [2, 2],
    6: [3, 2],
    7: [4, 2],
    8: [4, 2],
    9: [3, 3],
    10: [5, 2],
    11: [4, 3],
    12: [3, 4],
    13: [4, 4],
    14: [4, 4],
    15: [4, 4],
    16: [4, 4],
    17: [4, 5],
    18: [9, 2],
    19: [4, 5],
    20: [5, 4],
    21: [4, 6],
    22: [4, 6],
    23: [4, 6],
    24: [6, 4],
    25: [4, 7],
    26: [4, 7],
    27: [4, 7],
    28: [7, 4],
    29: [4, 8],
    30: [4, 8],
    31: [4, 8],
    32: [8, 4],
    33: [4, 9],
    34: [4, 9],
    35: [4, 9],
    36: [9, 4],
    37: [4, 10],
    38: [4, 10],
    39: [4, 10],
    40: [10, 4],
    41: [4, 11],
    42: [4, 11],
    43: [4, 11],
    44: [11, 4],
    45: [4, 12],
    46: [4, 12],
    47: [4, 12],
    48: [12, 4],
    49: [4, 13],
    50: [4, 13],
    51: [4, 13],
    52: [13, 4],
    53: [4, 14],
    54: [4, 14],
    55: [4, 14],
    56: [14, 4],
    57: [4, 15],
    58: [4, 15],
    59: [4, 15],
    60: [15, 4],
    61: [4, 16],
    62: [4, 16],
    63: [4, 16],
    64: [16, 4],
  };

  /**
   * Layout table for sequences with start position as a TOP ROW.
   * Derived from WITHOUT_START by adding 1 row.
   * The start pictograph and QR code occupy cells in row 0.
   * Steps begin at row 1 using the same column count as WITHOUT_START.
   */
  private readonly LAYOUT_WITH_START_ROW: Record<number, [number, number]> =
    Object.fromEntries(
      Object.entries(this.LAYOUT_WITHOUT_START_POSITION).map(
        ([stepCount, [cols, rows]]) => [stepCount, [cols, rows + 1]]
      )
    ) as Record<number, [number, number]>;

  /**
   * Portrait-optimized layout table for start position as a LEFT COLUMN.
   * Designed for playing card aspect ratio (5:7) — fewer columns, more rows
   * than the desktop-oriented LAYOUT_WITH_START_POSITION table.
   *
   * Format: stepCount -> [columns, rows]
   * Column 0 = start position, remaining columns = steps.
   */
  private readonly LAYOUT_WITH_START_COLUMN: Record<number, [number, number]> = {
    // Format: [cols, rows] where col 0 = start, cols 1..N = steps
    // Step capacity = (cols - 1) * rows
    0: [1, 1],
    1: [2, 1],      // 1 step col × 1 row = 1
    2: [2, 2],      // 1 × 2 = 2
    3: [2, 3],      // 1 × 3 = 3
    4: [3, 2],      // 2 × 2 = 4
    5: [3, 3],      // 2 × 3 = 6 (fits 5)
    6: [3, 3],      // 2 × 3 = 6
    7: [3, 4],      // 2 × 4 = 8 (fits 7)
    8: [3, 4],      // 2 × 4 = 8 ← portrait-friendly for playing cards
    9: [4, 3],      // 3 × 3 = 9
    10: [3, 5],     // 2 × 5 = 10
    11: [4, 4],     // 3 × 4 = 12 (fits 11)
    12: [4, 4],     // 3 × 4 = 12
    13: [4, 5],     // 3 × 5 = 15 (fits 13)
    14: [4, 5],     // 3 × 5 = 15 (fits 14)
    15: [4, 5],     // 3 × 5 = 15
    16: [5, 4],     // 4 × 4 = 16
    17: [5, 5],     // 4 × 5 = 20 (fits 17-20)
    18: [5, 5],
    19: [5, 5],
    20: [5, 5],
  };

  /**
   * Calculate optimal layout for given beat count.
   *
   * @param startPositionLayout - "row" puts start in a top row, "column" puts it in a left column.
   *   Defaults to "row". When "column", uses portrait-optimized column layouts.
   */
  calculateLayout(
    stepCount: number,
    includeStartPosition: boolean,
    startPositionLayout: "row" | "column" = "row"
  ): [number, number] {
    if (!this.validateLayout(stepCount, includeStartPosition)) {
      throw new Error(
        `Invalid layout parameters: stepCount=${stepCount}, includeStartPosition=${includeStartPosition}`
      );
    }

    let layoutTable: Record<number, [number, number]>;
    if (!includeStartPosition) {
      layoutTable = this.LAYOUT_WITHOUT_START_POSITION;
    } else if (startPositionLayout === "column") {
      layoutTable = this.LAYOUT_WITH_START_COLUMN;
    } else {
      layoutTable = this.LAYOUT_WITH_START_ROW;
    }

    // Check if we have a predefined layout for this beat count
    if (stepCount in layoutTable) {
      return layoutTable[stepCount]!;
    }

    // Fallback for beat counts beyond our tables
    return this.getFallbackLayout(stepCount, includeStartPosition);
  }

  /**
   * Calculate image dimensions for layout
   * Matches desktop _create_image() method
   */
  calculateImageDimensions(
    layout: [number, number],
    additionalHeight: number,
    stepScale: number = 1,
    stepSize?: number
  ): [number, number] {
    const [columns, rows] = layout;
    // Use explicit stepSize if provided, otherwise calculate from BASE_BEAT_SIZE
    const actualBeatSize =
      stepSize ?? LayoutCalculator.BASE_BEAT_SIZE * stepScale;

    const width = Math.floor(columns * actualBeatSize);
    const height = Math.floor(rows * actualBeatSize + additionalHeight);

    return [width, height];
  }

  /**
   * Get layout for current beat grid (compatibility method)
   * Matches desktop get_current_beat_frame_layout()
   */
  getCurrentBeatGridLayout(stepCount: number): [number, number] {
    // For web implementation, we use the same logic as calculateLayout
    // This method exists for compatibility with desktop patterns
    return this.calculateLayout(stepCount, false);
  }

  /**
   * Validate layout parameters
   */
  validateLayout(stepCount: number, includeStartPosition: boolean): boolean {
    // Beat count must be non-negative
    if (stepCount < 0) {
      return false;
    }

    // Beat count must be reasonable (prevent memory issues)
    if (stepCount > 1000) {
      return false;
    }

    // includeStartPosition must be boolean
    if (typeof includeStartPosition !== "boolean") {
      return false;
    }

    return true;
  }

  /**
   * Generate fallback layout for beat counts beyond predefined tables
   * Matches desktop fallback behavior
   */
  private getFallbackLayout(
    stepCount: number,
    includeStartPosition: boolean
  ): [number, number] {
    if (stepCount === 0) {
      return [1, 1];
    }

    // For large beat counts, prefer roughly square layouts
    const aspectRatio = 1.2; // Slightly wider than square

    // Calculate ideal dimensions from step count alone
    const idealHeight = Math.sqrt(stepCount / aspectRatio);
    const rows = Math.max(1, Math.round(idealHeight));
    const columns = Math.max(1, Math.ceil(stepCount / rows));

    if (includeStartPosition) {
      return [columns, rows + 1];
    }
    return [columns, rows];
  }

  /**
   * Get base beat size constant
   */
  static getBaseBeatSize(): number {
    return LayoutCalculator.BASE_BEAT_SIZE;
  }

  /**
   * Calculate total image area for layout
   */
  calculateImageArea(
    stepCount: number,
    includeStartPosition: boolean,
    additionalHeight: number,
    stepScale: number = 1
  ): number {
    const layout = this.calculateLayout(stepCount, includeStartPosition);
    const [width, height] = this.calculateImageDimensions(
      layout,
      additionalHeight,
      stepScale
    );
    return width * height;
  }

  /**
   * Get layout efficiency (how well steps fill the grid)
   */
  getLayoutEfficiency(
    stepCount: number,
    includeStartPosition: boolean
  ): number {
    if (stepCount === 0) return 1.0;

    const layout = this.calculateLayout(stepCount, includeStartPosition);
    const [columns, rows] = layout;
    const totalCells = columns * rows;
    const usedCells = includeStartPosition ? stepCount + 1 : stepCount;

    return usedCells / totalCells;
  }

  /**
   * Get all available layouts within a beat count range
   */
  getLayoutsInRange(
    minSteps: number,
    maxBeats: number,
    includeStartPosition: boolean
  ): Array<{
    stepCount: number;
    layout: [number, number];
    efficiency: number;
  }> {
    const results = [];

    for (let stepCount = minSteps; stepCount <= maxBeats; stepCount++) {
      if (this.validateLayout(stepCount, includeStartPosition)) {
        const layout = this.calculateLayout(stepCount, includeStartPosition);
        const efficiency = this.getLayoutEfficiency(
          stepCount,
          includeStartPosition
        );

        results.push({
          stepCount,
          layout,
          efficiency,
        });
      }
    }

    return results;
  }

  /**
   * Calculate the aspect ratio for gallery thumbnails given a beat count.
   *
   * Gallery thumbnails use fixed composition options:
   * - includeStartPosition: true
   * - addWord: true (headerHeight = stepSize / 3)
   * - showCreatorName/Notes/Birthday: true (footerHeight = stepSize / 7)
   *
   * Formula:
   *   width = columns * stepSize
   *   height = rows * stepSize + stepSize/3 + stepSize/7
   *          = stepSize * (rows + 10/21)
   *   aspectRatio = columns / (rows + 10/21)
   *
   * @param stepCount Number of steps in the sequence (not including start position)
   * @returns Aspect ratio (width / height) for the gallery thumbnail
   */
  calculateGalleryAspectRatio(stepCount: number): number {
    // Gallery variant always includes start position
    const [columns, rows] = this.calculateLayout(stepCount, true);

    // Header = stepSize/3, Footer = stepSize/7
    // Total fractional height: 1/3 + 1/7 = 7/21 + 3/21 = 10/21
    const additionalHeightFraction = 10 / 21;

    return columns / (rows + additionalHeightFraction);
  }

  /**
   * Calculate the aspect ratio for a thumbnail given beat count and options.
   * More flexible than calculateGalleryAspectRatio for custom compositions.
   *
   * @param stepCount Number of steps in the sequence
   * @param options.includeStartPosition Whether start position is shown
   * @param options.hasHeader Whether word/difficulty header is shown (adds stepSize/3)
   * @param options.hasFooter Whether creator/notes/birthday footer is shown (adds stepSize/7)
   */
  calculateThumbnailAspectRatio(
    stepCount: number,
    options: {
      includeStartPosition?: boolean;
      hasHeader?: boolean;
      hasFooter?: boolean;
    } = {}
  ): number {
    const {
      includeStartPosition = true,
      hasHeader = true,
      hasFooter = true,
    } = options;

    const [columns, rows] = this.calculateLayout(stepCount, includeStartPosition);

    // Calculate additional height fraction relative to stepSize
    let additionalHeightFraction = 0;
    if (hasHeader) additionalHeightFraction += 1 / 3; // stepSize / 3
    if (hasFooter) additionalHeightFraction += 1 / 7; // stepSize / 7

    return columns / (rows + additionalHeightFraction);
  }

  /**
   * Debug method to verify layout table integrity
   */
  validateLayoutTables(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check that all entries in WITH_START table are valid
    for (const [stepCount, layout] of Object.entries(
      this.LAYOUT_WITH_START_POSITION
    )) {
      const [columns, rows] = layout;
      const totalCells = columns * rows;
      const requiredCells = parseInt(stepCount) + 1; // +1 for start position

      if (totalCells < requiredCells) {
        errors.push(
          `WITH_START[${stepCount}]: ${columns}×${rows} = ${totalCells} cells < ${requiredCells} required`
        );
      }
    }

    // Check that all entries in WITHOUT_START table are valid
    for (const [stepCount, layout] of Object.entries(
      this.LAYOUT_WITHOUT_START_POSITION
    )) {
      const [columns, rows] = layout;
      const totalCells = columns * rows;
      const requiredCells = parseInt(stepCount);

      if (totalCells < requiredCells) {
        errors.push(
          `WITHOUT_START[${stepCount}]: ${columns}×${rows} = ${totalCells} cells < ${requiredCells} required`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// DIRECT EXPORT - Use this instead of container.items.layoutCalculator
// This avoids DI container rebuilds when this file changes
export const layoutCalculator = new LayoutCalculator();
