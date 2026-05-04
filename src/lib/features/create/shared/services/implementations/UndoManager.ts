/**
 * Undo/Redo Service Implementation
 *
 * Professional undo/redo management using Command Pattern with persistent storage.
 * Handles complex async operations and provides a clean API for Create module operations.
 *
 * Uses Svelte 5 runes for reactive state management.
 */

import { browser } from "$app/environment";
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
  [key: string]: unknown;
}

/**
 * Snapshot of Create Module State at a specific point in time
 */
export interface CreateModuleStateSnapshot {
  sequence: SequenceData | null;
  selectedStepNumber: number | null;
  activeSection: ActiveCreateModule | null;
  shouldShowStartPositionPicker?: boolean;
  timestamp: number;
}

/**
 * A single undoable action in the history
 */
export interface UndoHistoryEntry {
  id: string;
  type: UndoOperationType;
  timestamp: number;
  beforeState: CreateModuleStateSnapshot;
  afterState?: CreateModuleStateSnapshot;
  metadata?: UndoMetadata;
}

/**
 * Default maximum number of undo entries to keep
 */
const DEFAULT_MAX_HISTORY_SIZE = 50;

/**
 * LocalStorage key for persisting undo history
 */
const UNDO_HISTORY_STORAGE_KEY = "tka_build_undo_history";

/**
 * LocalStorage key for persisting redo history
 */
const REDO_HISTORY_STORAGE_KEY = "tka_build_redo_history";

/**
 * Human-readable descriptions for operation types
 */
const OPERATION_DESCRIPTIONS: Record<UndoOperationType, string> = {
  SELECT_START_POSITION: "Select Start Position",
  ADD_BEAT: "Add Beat",
  REMOVE_BEATS: "Remove Steps",
  CLEAR_SEQUENCE: "Clear Sequence",
  UPDATE_BEAT: "Update Beat",
  INSERT_BEAT: "Insert Beat",
  BATCH_EDIT: "Batch Edit",
  MIRROR_SEQUENCE: "Mirror",
  FLIP_SEQUENCE: "Flip",
  ROTATE_SEQUENCE: "Rotate",
  SWAP_COLORS: "Swap Colors",
  INVERT_SEQUENCE: "Invert",
  REWIND_SEQUENCE: "Rewind",
  SHIFT_START: "Shift Start",
  APPLY_TURN_PATTERN: "Apply Turn Pattern",
  APPLY_ROTATION_PATTERN: "Apply Rotation Pattern",
  APPLY_DURATION_PATTERN: "Apply Duration Pattern",
  EXTEND_SEQUENCE: "Extend",
  MODIFY_BEAT_PROPERTIES: "Modify Beat Properties",
  GENERATE_SEQUENCE: "Generate Sequence",
  SPELL_GENERATE: "Spell Generate",
  SPELL_APPLY_LOOP: "Spell Apply LOOP",
};

export class UndoManager {
  // Pure TypeScript arrays - reactivity handled by wrapper
  private _undoHistory: UndoHistoryEntry[] = [];
  private _redoHistory: UndoHistoryEntry[] = [];
  private _maxHistorySize: number = DEFAULT_MAX_HISTORY_SIZE;
  private _changeCallbacks: Set<() => void> = new Set();

  constructor() {
    // Load persisted history
    void this.loadHistory();
  }

  // ============================================================================
  // EVENT SYSTEM FOR REACTIVITY
  // ============================================================================

  /**
   * Subscribe to changes in undo/redo state
   */
  onChange(callback: () => void): () => void {
    this._changeCallbacks.add(callback);
    // Return unsubscribe function
    return () => this._changeCallbacks.delete(callback);
  }

  /**
   * Notify all subscribers of state change
   */
  private notifyChange(): void {
    this._changeCallbacks.forEach((callback) => callback());
  }

  // ============================================================================
  // PUBLIC GETTERS
  // ============================================================================

  get maxHistorySize(): number {
    return this._maxHistorySize;
  }

  get canUndo(): boolean {
    return this._undoHistory.length > 0;
  }

  get canRedo(): boolean {
    return this._redoHistory.length > 0;
  }

  get undoHistory(): ReadonlyArray<UndoHistoryEntry> {
    return this._undoHistory;
  }

  get redoHistory(): ReadonlyArray<UndoHistoryEntry> {
    return this._redoHistory;
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Push a new action to the undo history
   */
  pushUndo(
    type: UndoOperationType,
    beforeState: CreateModuleStateSnapshot,
    metadata?: UndoMetadata
  ): string {
    // Generate unique ID for this action
    const id = this.generateActionId();

    // Create history entry
    const entry: UndoHistoryEntry = {
      id,
      type,
      timestamp: Date.now(),
      beforeState,
      metadata: metadata ?? { description: "" },
    };

    // Add to undo history
    this._undoHistory.push(entry);

    // Trim history if it exceeds max size
    if (this._undoHistory.length > this._maxHistorySize) {
      this._undoHistory.shift();
    }

    // Clear redo history when new action is performed
    this._redoHistory = [];

    // Persist to storage
    this.saveHistory().catch((error) => {
      console.error(
        "❌ UndoManager: Failed to save history after push:",
        error
      );
    });

    // Notify subscribers of change
    this.notifyChange();

    return id;
  }

  /**
   * Undo the last operation.
   * If activeSection is provided, only undoes entries from that tab.
   */
  undo(activeSection?: string | null): UndoHistoryEntry | null {
    if (!this.canUndo) {
      return null;
    }

    if (activeSection) {
      // Find the most recent entry belonging to this tab
      let targetIndex = -1;
      for (let i = this._undoHistory.length - 1; i >= 0; i--) {
        if (this._undoHistory[i]!.beforeState.activeSection === activeSection) {
          targetIndex = i;
          break;
        }
      }
      if (targetIndex === -1) return null;

      // Remove from undo history and move to redo history
      const [entry] = this._undoHistory.splice(targetIndex, 1);
      if (!entry) return null;
      this._redoHistory.push(entry);

      this.saveHistory().catch((error) => {
        console.error(
          "❌ UndoManager: Failed to save history after undo:",
          error
        );
      });
      this.notifyChange();
      return entry;
    }

    // No filter - pop the last entry (legacy behavior)
    const entry = this._undoHistory.pop();
    if (!entry) {
      return null;
    }

    // Move to redo history
    this._redoHistory.push(entry);

    // Persist to storage
    this.saveHistory().catch((error) => {
      console.error(
        "❌ UndoManager: Failed to save history after undo:",
        error
      );
    });

    // Notify subscribers of change
    this.notifyChange();

    return entry;
  }

  /**
   * Check if there are undoable entries for a specific tab
   */
  canUndoForSection(activeSection: string): boolean {
    return this._undoHistory.some(
      (e) => e.beforeState.activeSection === activeSection
    );
  }

  /**
   * Redo the last undone operation
   */
  redo(): UndoHistoryEntry | null {
    if (!this.canRedo) {
      return null;
    }

    // Pop from redo history
    const entry = this._redoHistory.pop();
    if (!entry) {
      return null;
    }

    // Move back to undo history
    this._undoHistory.push(entry);

    // Persist to storage
    this.saveHistory().catch((error) => {
      console.error(
        "❌ UndoManager: Failed to save history after redo:",
        error
      );
    });

    // Notify subscribers of change
    this.notifyChange();

    return entry;
  }

  /**
   * Clear all undo and redo history
   */
  clearHistory(): void {
    this._undoHistory = [];
    this._redoHistory = [];

    // Persist to storage
    this.saveHistory().catch((error) => {
      console.error(
        "❌ UndoManager: Failed to save history after clear:",
        error
      );
    });

    // Notify subscribers of change
    this.notifyChange();
  }

  /**
   * Clear only redo history
   */
  clearRedoHistory(): void {
    this._redoHistory = [];

    // Persist to storage
    this.saveHistory().catch((error) => {
      console.error(
        "❌ UndoManager: Failed to save history after clearing redo:",
        error
      );
    });

    // Notify subscribers of change
    this.notifyChange();
  }

  /**
   * Get description of last undoable action.
   * If activeSection is provided, returns description of the last entry from that tab.
   */
  getLastUndoDescription(activeSection?: string | null): string | null {
    if (!this.canUndo) {
      return null;
    }

    let lastEntry;
    if (activeSection) {
      for (let i = this._undoHistory.length - 1; i >= 0; i--) {
        if (this._undoHistory[i]!.beforeState.activeSection === activeSection) {
          lastEntry = this._undoHistory[i];
          break;
        }
      }
    } else {
      lastEntry = this._undoHistory[this._undoHistory.length - 1];
    }

    if (!lastEntry) {
      return null;
    }

    // Use custom description if provided
    if (lastEntry.metadata?.description) {
      return lastEntry.metadata.description;
    }

    // Fall back to operation type description
    return OPERATION_DESCRIPTIONS[lastEntry.type] || "Last Action";
  }

  /**
   * Get description of last redoable action
   */
  getLastRedoDescription(): string | null {
    if (!this.canRedo) {
      return null;
    }

    const lastEntry = this._redoHistory[this._redoHistory.length - 1];
    if (!lastEntry) {
      return null;
    }

    // Use custom description if provided
    if (lastEntry.metadata?.description) {
      return lastEntry.metadata.description;
    }

    // Fall back to operation type description
    return OPERATION_DESCRIPTIONS[lastEntry.type] || "Last Action";
  }

  /**
   * Load history from persistent storage
   */
  async loadHistory(): Promise<void> {
    // Skip during SSR - no localStorage available
    if (!browser) {
      return;
    }

    try {
      // Load undo history
      const undoData = localStorage.getItem(UNDO_HISTORY_STORAGE_KEY);
      if (undoData) {
        this._undoHistory = JSON.parse(undoData);
      }

      // Load redo history
      const redoData = localStorage.getItem(REDO_HISTORY_STORAGE_KEY);
      if (redoData) {
        this._redoHistory = JSON.parse(redoData);
      }

      // Notify subscribers after loading
      this.notifyChange();
    } catch (error) {
      console.error(
        "❌ UndoManager: Failed to load history from storage:",
        error
      );
      // Reset to empty on error
      this._undoHistory = [];
      this._redoHistory = [];
      this.notifyChange();
    }
  }

  /**
   * Save history to persistent storage
   */
  async saveHistory(): Promise<void> {
    // Skip during SSR - no localStorage available
    if (!browser) {
      return;
    }

    try {
      localStorage.setItem(
        UNDO_HISTORY_STORAGE_KEY,
        JSON.stringify(this._undoHistory)
      );
      localStorage.setItem(
        REDO_HISTORY_STORAGE_KEY,
        JSON.stringify(this._redoHistory)
      );
    } catch (error) {
      console.error(
        "❌ UndoManager: Failed to save history to storage:",
        error
      );
      throw error;
    }
  }

  /**
   * Peek at the state that would be restored by undo
   */
  peekUndoState(): CreateModuleStateSnapshot | null {
    if (!this.canUndo) {
      return null;
    }

    const lastEntry = this._undoHistory[this._undoHistory.length - 1];
    return lastEntry ? lastEntry.beforeState : null;
  }

  /**
   * Peek at the state that would be restored by redo
   */
  peekRedoState(): CreateModuleStateSnapshot | null {
    if (!this.canRedo) {
      return null;
    }

    // For redo, we want the "after" state, which is the current state when the action was performed
    const entry = this._redoHistory[this._redoHistory.length - 1];
    return entry ? entry.afterState || null : null;
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Generate a unique action ID
   */
  private generateActionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Jump to a specific history entry by ID
   * Moves all entries between current position and target to appropriate stack
   */
  jumpToState(targetId: string): UndoHistoryEntry | null {
    // First, check if target is in undo history
    const undoIndex = this._undoHistory.findIndex((e) => e.id === targetId);
    if (undoIndex !== -1) {
      // Target is in undo history - need to undo back to that point
      // Move all entries from undoIndex+1 to end to redo stack
      const entriesToMove = this._undoHistory.splice(undoIndex + 1);
      // Reverse so most recent is at end of redo stack
      this._redoHistory.push(...entriesToMove.reverse());

      this.saveHistory().catch((error) => {
        console.error(
          "❌ UndoManager: Failed to save history after jump:",
          error
        );
      });
      this.notifyChange();

      return this._undoHistory[undoIndex] ?? null;
    }

    // Check if target is in redo history
    const redoIndex = this._redoHistory.findIndex((e) => e.id === targetId);
    if (redoIndex !== -1) {
      // Target is in redo history - need to redo up to that point
      // Move all entries from redoIndex to end to undo stack
      const entriesToMove = this._redoHistory.splice(redoIndex);
      // Reverse so they go back in correct order
      this._undoHistory.push(...entriesToMove.reverse());

      this.saveHistory().catch((error) => {
        console.error(
          "❌ UndoManager: Failed to save history after jump:",
          error
        );
      });
      this.notifyChange();

      return this._undoHistory[this._undoHistory.length - 1] ?? null;
    }

    return null; // Entry not found
  }

  /**
   * Get combined timeline of undo and redo entries
   * Shows undo stack (oldest to newest), then redo stack (newest to oldest)
   */
  getTimeline(): Array<UndoHistoryEntry & { isInRedoStack: boolean }> {
    // Undo history is ordered oldest to newest - past actions
    const undoEntries = this._undoHistory.map((entry) => ({
      ...entry,
      isInRedoStack: false,
    }));

    // Redo history is ordered oldest (first undone) to newest (most recently undone)
    // We reverse it so the "future" appears in order from closest to farthest
    const redoEntries = [...this._redoHistory].reverse().map((entry) => ({
      ...entry,
      isInRedoStack: true,
    }));

    return [...undoEntries, ...redoEntries];
  }

  /**
   * Get description for an operation type
   */
  getOperationDescription(type: UndoOperationType): string {
    return OPERATION_DESCRIPTIONS[type] || "Unknown Action";
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const undoManager = new UndoManager();
