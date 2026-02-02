/**
 * Conjoined Lab Domain Types
 *
 * Types for the dual-grid visualization where red and blue props
 * animate on separate adjacent grids with a shared conjoined point.
 */

/**
 * Grid arrangement options for how the two grids are positioned
 */
export type GridArrangement =
  | "left-right" // Grid A on left, Grid B on right
  | "top-bottom" // Grid A on top, Grid B on bottom
  | "diagonal-tl-br" // Top-left to bottom-right
  | "diagonal-tr-bl"; // Top-right to bottom-left

/**
 * Which of Grid A's outer points touches Grid B's center.
 * This determines the conjoined junction point.
 */
export type ConjoinedEdge = "n" | "e" | "s" | "w" | "ne" | "se" | "sw" | "nw";

/**
 * Configuration for the conjoined grid layout
 */
export interface ConjoinedLayout {
  /** How the two grids are arranged spatially */
  arrangement: GridArrangement;
  /** Which outer point of Grid A connects to Grid B's center */
  conjoinedEdge: ConjoinedEdge;
  /** Spacing between grids in pixels (0-200) */
  spacing: number;
  /** Whether to visually show the conjoined point */
  showConjoinedPoint: boolean;
}

/**
 * Position offset for a grid in the canvas coordinate system
 */
export interface GridOffset {
  x: number;
  y: number;
}

/**
 * Calculated positions for both grids
 */
export interface GridPositions {
  gridA: GridOffset;
  gridB: GridOffset;
}

/**
 * Canvas dimensions after calculating combined viewBox
 */
export interface CanvasDimensions {
  width: number;
  height: number;
  viewBox: string;
}

/**
 * Default layout configuration
 */
export const DEFAULT_CONJOINED_LAYOUT: ConjoinedLayout = {
  arrangement: "left-right",
  conjoinedEdge: "e",
  spacing: 0,
  showConjoinedPoint: false,
};
