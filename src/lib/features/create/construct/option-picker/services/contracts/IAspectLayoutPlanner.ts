/**
 * Aspect Layout Planner Service Interface
 *
 * Determines the optimal row arrangement for grouped sections
 * based on container aspect ratio.
 *
 * Used by OptionViewer456Group to decide whether to display
 * Types 4, 5, 6 vertically, horizontally, or in a 2-row layout.
 */

export interface TypeCount {
  type: string;
  count: number;
}

export interface LayoutRow {
  /** Types included in this row */
  types: string[];
  /** Width allocated to this row */
  containerWidth: number;
  /** Layout mode for this row */
  layout: "vertical" | "horizontal" | "row-1" | "row-2" | "single";
}

export interface IAspectLayoutPlanner {
  /**
   * Calculate optimal layout based on container aspect ratio.
   *
   * Layout strategy:
   * - Portrait (aspectRatio < 0.6): Stack vertically (3 rows)
   * - Square-ish (0.6 <= aspectRatio < 1.6): 2-row layout
   *   - Row 1: Type 4 (full width)
   *   - Row 2: Types 5 & 6 (side by side)
   * - Wide/Landscape (aspectRatio >= 1.6): Single horizontal row
   *
   * @param typeCounts Array of types with their pictograph counts
   * @param containerWidth Available container width
   * @param containerHeight Available container height
   * @returns Array of layout rows describing the arrangement
   */
  calculateOptimalLayout(
    typeCounts: TypeCount[],
    containerWidth: number,
    containerHeight: number
  ): LayoutRow[];

  /**
   * Get aspect ratio thresholds used for layout decisions.
   * Useful for debugging and testing.
   */
  getThresholds(): {
    portraitMax: number;
    landscapeMin: number;
  };
}
