/**
 * IArrangeUndoManager - Contract for Arrange tab undo/redo
 *
 * Captures grid cell snapshots before/after mutations using
 * the capture-before / commit-after pattern from TimelineUndoManager.
 * Session-only: undo history is NOT persisted to localStorage.
 */

import type { GridCell } from "../../state/arrange-grid-state.svelte";

/**
 * Types of undoable operations in the Arrange grid
 */
export type ArrangeUndoOperationType =
  | "SET_GRID_ROWS"
  | "SET_GRID_COLS"
  | "SET_PRESET_LAYOUT"
  | "SET_CELL_SPAN"
  | "ADD_LAYER"
  | "REMOVE_LAYER"
  | "UPDATE_LAYER_OFFSET"
  | "UPDATE_CELL_OFFSET"
  | "CLEAR_CELL"
  | "SET_MEDIA_TYPE"
  | "PASTE_SEQUENCE"
  | "TRANSFORM_LAYER"
  | "RESET"
  | "LOAD_COMPOSITION";

/**
 * Snapshot of the undoable portion of grid state.
 * Only cells are captured - selection and playback state are not undoable.
 */
export interface ArrangeGridSnapshot {
  cells: GridCell[];
}

/**
 * Result from undo/redo operations.
 * Bundles the snapshot with its description so callers don't need
 * to understand internal stack mechanics.
 */
export interface UndoResult {
  snapshot: ArrangeGridSnapshot;
  description: string;
}

/**
 * A single entry in the undo history
 */
export interface ArrangeUndoEntry {
  id: string;
  type: ArrangeUndoOperationType;
  timestamp: number;
  beforeState: ArrangeGridSnapshot;
  afterState?: ArrangeGridSnapshot;
  description: string;
  /** Key for coalescing rapid same-type operations (e.g. slider drags) */
  coalescingKey?: string;
}

/**
 * Undo manager interface for Arrange grid operations
 */
export interface IArrangeUndoManager {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoDescription: string | null;
  readonly redoDescription: string | null;

  /**
   * Initialize the undo manager with a snapshot provider.
   */
  init(getSnapshot: () => ArrangeGridSnapshot): void;

  /**
   * Capture current state before an operation.
   * Must be called BEFORE making changes.
   */
  captureState(type: ArrangeUndoOperationType, description: string): void;

  /**
   * Commit the operation after changes are made.
   * Must be called AFTER making changes.
   * Clears the redo stack.
   */
  commitState(): void;

  /**
   * Commit with coalescing: if the previous entry has the same key
   * and was committed within the time window, update its afterState
   * instead of creating a new entry. Prevents undo-spam from sliders/drags.
   */
  commitStateCoalescing(coalescingKey: string, windowMs?: number): void;

  /**
   * Cancel a pending operation (before commit).
   */
  cancelPending(): void;

  /**
   * Undo the last operation.
   * Returns the snapshot to restore and its description, or null if nothing to undo.
   */
  undo(): UndoResult | null;

  /**
   * Redo the last undone operation.
   * Returns the snapshot to restore and its description, or null if nothing to redo.
   */
  redo(): UndoResult | null;

  /**
   * Clear all history.
   */
  clear(): void;

  /**
   * Subscribe to history changes (for driving reactive state).
   * @returns Unsubscribe function
   */
  subscribe(callback: () => void): () => void;
}
