/**
 * IArrangeGridSerializer - Serializes grid state to a human-readable template format.
 *
 * Deduplicates sequences, foregrounds transforms, separates grid structure from content.
 * Used for clipboard export and debugging.
 */

import type { GridCell } from "../../state/arrange-grid-state.svelte";

export interface SerializationContext {
  cells: GridCell[];
  bpm: number;
  skipStartPosition: boolean;
  gridRows: number;
  gridCols: number;
}

export interface IArrangeGridSerializer {
  serialize(context: SerializationContext): string;
}
