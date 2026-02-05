/**
 * IConjoinedLayoutCalculator - Contract for calculating conjoined grid positions
 */

import type {
  ConjoinedLayout,
  GridPositions,
  CanvasDimensions,
  ConjoinedEdge,
} from "../../domain/types";

export interface IConjoinedLayoutCalculator {
  /**
   * Calculate the positions for both grids based on layout configuration
   */
  calculateGridPositions(layout: ConjoinedLayout): GridPositions;

  /**
   * Calculate the canvas dimensions needed to contain both grids
   */
  calculateCanvasDimensions(layout: ConjoinedLayout): CanvasDimensions;

  /**
   * Get the offset from grid center to the specified outer point
   */
  getOuterPointOffset(edge: ConjoinedEdge): { x: number; y: number };
}
