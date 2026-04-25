/**
 * IArrangeStepCalculator - Contract for polyrhythmic beat calculation
 *
 * Computes per-cell and cross-grid beat counts using LCM (least common multiple)
 * to support polyrhythmic playback where cells with different sequence lengths
 * align at their combined cycle length.
 */

import type { GridCell } from "../../state/arrange-grid-state.svelte";

export interface IArrangeStepCalculator {
  /**
   * Calculate the beat count for a single cell.
   * When a cell has multiple layers with different lengths,
   * returns the LCM of all layer lengths so every layer cycles evenly.
   */
  calculateCellBeats(cell: GridCell, skipStartPosition: boolean): number;

  /**
   * Calculate the total beat count across all visible cells with layers.
   * Returns the LCM of all individual cell beat counts.
   */
  calculateTotalBeats(
    cells: GridCell[],
    skipStartPosition: boolean,
    rows: number,
    cols: number
  ): number;
}
