/**
 * Undo/Redo Service Interface
 *
 * Professional undo/redo management for Create module operations.
 * Implements Command Pattern with action bundling for complex async operations.
 *
 * Based on industry best practices from modern web applications:
 * - Command Pattern for reversible operations
 * - Action bundling for handling concurrent async operations
 * - Memento Pattern for state snapshots
 * - Persistent history across sessions
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ActiveCreateModule } from "$lib/shared/foundation/ui/UITypes";

/**
 * Types of undoable operations in the Create module
 */
export enum UndoOperationType {
  // Sequence construction operations
  SELECT_START_POSITION = "SELECT_START_POSITION",
  ADD_BEAT = "ADD_BEAT",
  REMOVE_BEATS = "REMOVE_BEATS",
  CLEAR_SEQUENCE = "CLEAR_SEQUENCE",

  // Beat modification operations
  UPDATE_BEAT = "UPDATE_BEAT",
  INSERT_BEAT = "INSERT_BEAT",
  BATCH_EDIT = "BATCH_EDIT",

  // Transform operations
  MIRROR_SEQUENCE = "MIRROR_SEQUENCE",
  FLIP_SEQUENCE = "FLIP_SEQUENCE",
  ROTATE_SEQUENCE = "ROTATE_SEQUENCE",
  SWAP_COLORS = "SWAP_COLORS",
  INVERT_SEQUENCE = "INVERT_SEQUENCE",
  REWIND_SEQUENCE = "REWIND_SEQUENCE",
  SHIFT_START = "SHIFT_START",

  // Pattern operations
  APPLY_TURN_PATTERN = "APPLY_TURN_PATTERN",
  APPLY_ROTATION_PATTERN = "APPLY_ROTATION_PATTERN",
  APPLY_DURATION_PATTERN = "APPLY_DURATION_PATTERN",
  EXTEND_SEQUENCE = "EXTEND_SEQUENCE",

  // Edit operations
  MODIFY_BEAT_PROPERTIES = "MODIFY_BEAT_PROPERTIES",

  // Generate operations
  GENERATE_SEQUENCE = "GENERATE_SEQUENCE",

  // Spell module operations
  SPELL_GENERATE = "SPELL_GENERATE",
  SPELL_APPLY_LOOP = "SPELL_APPLY_LOOP",
}

/**
 * Metadata for undo history entries
 */
export interface UndoMetadata {
  stepIndex?: number;
  stepsRemoved?: number;
  description?: string;
  [key: string]: unknown; // Allow additional metadata
}

/**
 * Snapshot of Create Module State at a specific point in time
 */
export interface CreateModuleStateSnapshot {
  sequence: SequenceData | null;
  selectedStepNumber: number | null; // 0=start, 1=first beat, 2=second beat
  activeSection: ActiveCreateModule | null;
  shouldShowStartPositionPicker?: boolean;
  timestamp: number;
}

/**
 * A single undoable action in the history
 */
export interface UndoHistoryEntry {
  id: string; // Unique identifier for this action
  type: UndoOperationType;
  timestamp: number;
  beforeState: CreateModuleStateSnapshot;
  afterState?: CreateModuleStateSnapshot; // Optional: for redo optimization
  metadata?: UndoMetadata;
}

/**
 * Undo/Redo Service Interface
 */
export interface IUndoManager {
  /**
   * Maximum number of undo entries to keep in history
   */
  readonly maxHistorySize: number;

  /**
   * Whether there are actions that can be undone
   */
  readonly canUndo: boolean;

  /**
   * Whether there are actions that can be redone
   */
  readonly canRedo: boolean;

  /**
   * Current undo history (for debugging/UI display)
   */
  readonly undoHistory: ReadonlyArray<UndoHistoryEntry>;

  /**
   * Current redo history (for debugging/UI display)
   */
  readonly redoHistory: ReadonlyArray<UndoHistoryEntry>;

  /**
   * Push a new action to the undo history
   * Clears redo history when a new action is performed
   *
   * @param type - Type of operation being performed
   * @param beforeState - State snapshot before the operation
   * @param metadata - Optional metadata about the operation
   * @returns The unique ID of the created history entry
   */
  pushUndo(
    type: UndoOperationType,
    beforeState: CreateModuleStateSnapshot,
    metadata?: UndoMetadata
  ): string;

  /**
   * Undo the last operation.
   * If activeSection is provided, only undoes the most recent entry from that tab.
   * Moves the entry from undo history to redo history.
   *
   * @param activeSection - Optional tab filter (e.g. "construct", "generate", "assemble")
   * @returns The history entry that was undone, or null if nothing to undo
   */
  undo(activeSection?: string | null): UndoHistoryEntry | null;

  /**
   * Check if there are undoable entries for a specific tab
   */
  canUndoForSection(activeSection: string): boolean;

  /**
   * Redo the last undone operation
   * Moves the entry from redo history back to undo history
   *
   * @returns The history entry that was redone, or null if nothing to redo
   */
  redo(): UndoHistoryEntry | null;

  /**
   * Clear all undo and redo history
   */
  clearHistory(): void;

  /**
   * Clear only redo history (called when new action is performed)
   */
  clearRedoHistory(): void;

  /**
   * Get a human-readable description of the last undoable action
   *
   * @returns Description string or null if no undo available
   */
  getLastUndoDescription(): string | null;

  /**
   * Get a human-readable description of the last redoable action
   *
   * @returns Description string or null if no redo available
   */
  getLastRedoDescription(): string | null;

  /**
   * Load undo/redo history from persistent storage
   * Called during initialization
   */
  loadHistory(): Promise<void>;

  /**
   * Save undo/redo history to persistent storage
   * Called after each history modification
   */
  saveHistory(): Promise<void>;

  /**
   * Get the state snapshot that would be restored by undo
   * Useful for preview/debugging without actually undoing
   *
   * @returns The state snapshot or null if nothing to undo
   */
  peekUndoState(): CreateModuleStateSnapshot | null;

  /**
   * Get the state snapshot that would be restored by redo
   * Useful for preview/debugging without actually redoing
   *
   * @returns The state snapshot or null if nothing to redo
   */
  peekRedoState(): CreateModuleStateSnapshot | null;

  /**
   * Subscribe to changes in undo/redo state
   * Used by reactive wrappers to track state changes
   *
   * @param callback - Function to call when state changes
   * @returns Unsubscribe function
   */
  onChange(callback: () => void): () => void;

  /**
   * Jump to a specific history entry by ID
   * Used by history panel to restore any previous state
   * Moves all entries between current position and target to the appropriate stack
   *
   * @param targetId - The ID of the history entry to jump to
   * @returns The target entry, or null if not found
   */
  jumpToState(targetId: string): UndoHistoryEntry | null;

  /**
   * Get the combined timeline of undo and redo entries
   * Undo entries (past) come first, then redo entries (future) in reverse
   * Used by history panel to display full timeline
   *
   * @returns Array of all entries with isCurrentPosition marker
   */
  getTimeline(): Array<UndoHistoryEntry & { isInRedoStack: boolean }>;

  /**
   * Get a description for an operation type
   *
   * @param type - The operation type
   * @returns Human-readable description
   */
  getOperationDescription(type: UndoOperationType): string;
}
