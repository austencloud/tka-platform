/**
 * IArrangeCompositionConverter
 *
 * Converts between the Arrange tab's GridCell[] format and the
 * Composition format used by Dexie persistence and the Browse tab.
 */

import type { Composition } from "../../../../compose/domain/types";
import type { GridCell } from "../../state/arrange-grid-state.svelte";

export interface GridStateSnapshot {
  cells: GridCell[];
  gridRows: number;
  gridCols: number;
  bpm: number;
  skipStartPosition: boolean;
}

export interface IArrangeCompositionConverter {
  /**
   * Convert Arrange grid state → Composition for Dexie persistence.
   * Only includes visible cells (within gridRows x gridCols) that have layers.
   */
  gridCellsToComposition(
    id: string,
    name: string,
    snapshot: GridStateSnapshot
  ): Composition;

  /**
   * Convert a Composition from Dexie → Arrange grid state.
   * Creates a full 8x8 backing array and populates the relevant cells.
   */
  compositionToGridState(composition: Composition): GridStateSnapshot;
}
