/**
 * ITimelineUndoManager - Contract for timeline undo/redo functionality
 *
 * Implements command pattern with state snapshots (Memento pattern)
 * for undoing/redoing timeline operations.
 */

import type { TimelineProject } from "../../domain/timeline-types";

/**
 * Types of undoable operations in the timeline
 */
export type TimelineUndoOperationType =
  | "ADD_CLIP"
  | "REMOVE_CLIP"
  | "REMOVE_CLIPS"
  | "MOVE_CLIP"
  | "TRIM_CLIP"
  | "RESIZE_CLIP"
  | "UPDATE_CLIP"
  | "DUPLICATE_CLIP"
  | "ADD_TRACK"
  | "REMOVE_TRACK"
  | "UPDATE_TRACK"
  | "REORDER_TRACKS"
  | "UPDATE_PROJECT"
  | "BATCH";

/**
 * Snapshot of timeline project state for undo/redo
 */
export interface TimelineProjectSnapshot {
  project: TimelineProject;
  timestamp: number;
}

/**
 * A single entry in the undo history
 */
export interface TimelineUndoEntry {
  /** Unique ID for this entry */
  id: string;

  /** Type of operation that was performed */
  type: TimelineUndoOperationType;

  /** When the operation occurred */
  timestamp: number;

  /** State before the operation */
  beforeState: TimelineProjectSnapshot;

  /** State after the operation (captured on commit) */
  afterState?: TimelineProjectSnapshot;

  /** Human-readable description for UI */
  description: string;
}

/**
 * Undo manager interface for timeline operations
 */
export interface ITimelineUndoManager {
  // =========================================================================
  // State Getters
  // =========================================================================

  /** Whether there are operations to undo */
  readonly canUndo: boolean;

  /** Whether there are operations to redo */
  readonly canRedo: boolean;

  /** Description of the operation that would be undone */
  readonly undoDescription: string | null;

  /** Description of the operation that would be redone */
  readonly redoDescription: string | null;

  /** Number of entries in undo stack */
  readonly undoCount: number;

  /** Number of entries in redo stack */
  readonly redoCount: number;

  // =========================================================================
  // Core Operations
  // =========================================================================

  /**
   * Capture current state before an operation.
   * Must be called BEFORE making changes.
   *
   * @param type - The type of operation being performed
   * @param description - Human-readable description (e.g., "Add clip 'HELLO'")
   */
  captureState(type: TimelineUndoOperationType, description: string): void;

  /**
   * Commit the operation after changes are made.
   * Must be called AFTER making changes.
   * Clears the redo stack.
   */
  commitState(): void;

  /**
   * Cancel a pending operation (before commit).
   * Use if an operation fails or is cancelled.
   */
  cancelPending(): void;

  /**
   * Undo the last operation.
   * Returns the state to restore, or null if nothing to undo.
   */
  undo(): TimelineProjectSnapshot | null;

  /**
   * Redo the last undone operation.
   * Returns the state to restore, or null if nothing to redo.
   */
  redo(): TimelineProjectSnapshot | null;

  /**
   * Clear all history (undo and redo stacks).
   */
  clear(): void;

  // =========================================================================
  // Persistence
  // =========================================================================

  /**
   * Save history to localStorage.
   */
  save(): void;

  /**
   * Load history from localStorage.
   */
  load(): void;

  // =========================================================================
  // Observable
  // =========================================================================

  /**
   * Subscribe to history changes.
   * @param callback - Called when history changes
   * @returns Unsubscribe function
   */
  subscribe(callback: () => void): () => void;
}
