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
   * Format: beatCount -> [columns, rows]
   */
  private readonly LAYOUT_WITH_START_POSITION: Record<
    number,
    [number, number]
  > = {
    0: [1, 1],
    1: [2, 1],
    2: [3, 1],
    3: [4, 1],
    4: [5, 1],
    5: [5, 2],
    6: [5, 2],
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
   * Format: beatCount -> [columns, rows]
   */
  private readonly LAYOUT_WITHOUT_START_POSITION: Record<
    number,
    [number, number]
  > = {
    0: [1, 1],
    1: [1, 1],
    2: [2, 1],
    3: [3, 1],
    4: [4, 1],
    5: [3, 2],
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
   * Calculate optimal layout for given beat count
   * Matches desktop calculate_layout() method exactly
   */
  calculateLayout(
    beatCount: number,
    includeStartPosition: boolean
  ): [number, number] {
    if (!this.validateLayout(beatCount, includeStartPosition)) {
      throw new Error(
        `Invalid layout parameters: beatCount=${beatCount}, includeStartPosition=${includeStartPosition}`
      );
    }

    const layoutTable = includeStartPosition
      ? this.LAYOUT_WITH_START_POSITION
      : this.LAYOUT_WITHOUT_START_POSITION;

    // Check if we have a predefined layout for this beat count
    if (beatCount in layoutTable) {
      return layoutTable[beatCount]!;
    }

    // Fallback for beat counts beyond our tables
    return this.getFallbackLayout(beatCount, includeStartPosition);
  }

  /**
   * Calculate image dimensions for layout
   * Matches desktop _create_image() method
   */
  calculateImageDimensions(
    layout: [number, number],
    additionalHeight: number,
    beatScale: number = 1,
    beatSize?: number
  ): [number, number] {
    const [columns, rows] = layout;
    // Use explicit beatSize if provided, otherwise calculate from BASE_BEAT_SIZE
    const actualBeatSize =
      beatSize ?? LayoutCalculator.BASE_BEAT_SIZE * beatScale;

    const width = Math.floor(columns * actualBeatSize);
    const height = Math.floor(rows * actualBeatSize + additionalHeight);

    return [width, height];
  }

  /**
   * Get layout for current beat grid (compatibility method)
   * Matches desktop get_current_beat_frame_layout()
   */
  getCurrentBeatGridLayout(beatCount: number): [number, number] {
    // For web implementation, we use the same logic as calculateLayout
    // This method exists for compatibility with desktop patterns
    return this.calculateLayout(beatCount, false);
  }

  /**
   * Validate layout parameters
   */
  validateLayout(beatCount: number, includeStartPosition: boolean): boolean {
    // Beat count must be non-negative
    if (beatCount < 0) {
      return false;
    }

    // Beat count must be reasonable (prevent memory issues)
    if (beatCount > 1000) {
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
    beatCount: number,
    includeStartPosition: boolean
  ): [number, number] {
    if (beatCount === 0) {
      return [1, 1];
    }

    // For large beat counts, prefer roughly square layouts
    const totalCells = includeStartPosition ? beatCount + 1 : beatCount;
    const aspectRatio = 1.2; // Slightly wider than square

    // Calculate ideal dimensions
    const idealHeight = Math.sqrt(totalCells / aspectRatio);
    const rows = Math.max(1, Math.round(idealHeight));
    const columns = Math.max(1, Math.ceil(totalCells / rows));

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
    beatCount: number,
    includeStartPosition: boolean,
    additionalHeight: number,
    beatScale: number = 1
  ): number {
    const layout = this.calculateLayout(beatCount, includeStartPosition);
    const [width, height] = this.calculateImageDimensions(
      layout,
      additionalHeight,
      beatScale
    );
    return width * height;
  }

  /**
   * Get layout efficiency (how well beats fill the grid)
   */
  getLayoutEfficiency(
    beatCount: number,
    includeStartPosition: boolean
  ): number {
    if (beatCount === 0) return 1.0;

    const layout = this.calculateLayout(beatCount, includeStartPosition);
    const [columns, rows] = layout;
    const totalCells = columns * rows;
    const usedCells = includeStartPosition ? beatCount + 1 : beatCount;

    return usedCells / totalCells;
  }

  /**
   * Get all available layouts within a beat count range
   */
  getLayoutsInRange(
    minBeats: number,
    maxBeats: number,
    includeStartPosition: boolean
  ): Array<{
    beatCount: number;
    layout: [number, number];
    efficiency: number;
  }> {
    const results = [];

    for (let beatCount = minBeats; beatCount <= maxBeats; beatCount++) {
      if (this.validateLayout(beatCount, includeStartPosition)) {
        const layout = this.calculateLayout(beatCount, includeStartPosition);
        const efficiency = this.getLayoutEfficiency(
          beatCount,
          includeStartPosition
        );

        results.push({
          beatCount,
          layout,
          efficiency,
        });
      }
    }

    return results;
  }

  /**
   * Debug method to verify layout table integrity
   */
  validateLayoutTables(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check that all entries in WITH_START table are valid
    for (const [beatCount, layout] of Object.entries(
      this.LAYOUT_WITH_START_POSITION
    )) {
      const [columns, rows] = layout;
      const totalCells = columns * rows;
      const requiredCells = parseInt(beatCount) + 1; // +1 for start position

      if (totalCells < requiredCells) {
        errors.push(
          `WITH_START[${beatCount}]: ${columns}×${rows} = ${totalCells} cells < ${requiredCells} required`
        );
      }
    }

    // Check that all entries in WITHOUT_START table are valid
    for (const [beatCount, layout] of Object.entries(
      this.LAYOUT_WITHOUT_START_POSITION
    )) {
      const [columns, rows] = layout;
      const totalCells = columns * rows;
      const requiredCells = parseInt(beatCount);

      if (totalCells < requiredCells) {
        errors.push(
          `WITHOUT_START[${beatCount}]: ${columns}×${rows} = ${totalCells} cells < ${requiredCells} required`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
