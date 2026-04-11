/**
 * Viewer 3D Undo Manager Implementation
 *
 * Snapshot-based undo for the 3D viewer. Pattern borrowed from
 * features/create/shared/services/implementations/UndoManager.ts, simplified:
 * no localStorage persistence (viewer undo is ephemeral), no per-section filtering.
 */

import type {
  IViewer3DUndoManager,
  ViewerOperationType,
  ViewerSnapshot,
  ViewerUndoEntry,
} from "../contracts/IViewer3DUndoManager";

const DEFAULT_MAX_HISTORY_SIZE = 50;

export class Viewer3DUndoManager implements IViewer3DUndoManager {
  private _undoHistory: ViewerUndoEntry[] = [];
  private _redoHistory: ViewerUndoEntry[] = [];
  private _maxHistorySize: number = DEFAULT_MAX_HISTORY_SIZE;
  private _changeCallbacks: Set<() => void> = new Set();
  private _nextId: number = 0;

  get maxHistorySize(): number {
    return this._maxHistorySize;
  }

  get canUndo(): boolean {
    return this._undoHistory.length > 0;
  }

  get canRedo(): boolean {
    return this._redoHistory.length > 0;
  }

  get undoHistory(): ReadonlyArray<ViewerUndoEntry> {
    return this._undoHistory;
  }

  get redoHistory(): ReadonlyArray<ViewerUndoEntry> {
    return this._redoHistory;
  }

  onChange(callback: () => void): () => void {
    this._changeCallbacks.add(callback);
    return () => this._changeCallbacks.delete(callback);
  }

  private notifyChange(): void {
    this._changeCallbacks.forEach((cb) => cb());
  }

  private generateId(): string {
    this._nextId += 1;
    return `viewer3d-undo-${Date.now()}-${this._nextId}`;
  }

  pushSnapshot(type: ViewerOperationType, beforeState: ViewerSnapshot): string {
    const entry: ViewerUndoEntry = {
      id: this.generateId(),
      type,
      beforeState,
      afterState: undefined,
      timestamp: Date.now(),
    };

    this._undoHistory.push(entry);

    // Enforce cap: drop the oldest entry when we exceed maxHistorySize.
    if (this._undoHistory.length > this._maxHistorySize) {
      this._undoHistory.shift();
    }

    // New push invalidates the redo stack.
    this._redoHistory = [];

    this.notifyChange();
    return entry.id;
  }

  completeEntry(id: string, afterState: ViewerSnapshot): void {
    // Look up the entry by id. Most commonly it's the top of the undo stack,
    // but completeEntry is safe to call on any in-flight entry.
    for (let i = this._undoHistory.length - 1; i >= 0; i--) {
      const entry = this._undoHistory[i];
      if (entry && entry.id === id) {
        entry.afterState = afterState;
        return;
      }
    }
    // No match — silently ignore. This happens if the entry was trimmed by
    // the cap between push and complete, which is fine for undo semantics.
  }

  undo(): ViewerUndoEntry | null {
    if (!this.canUndo) return null;
    const entry = this._undoHistory.pop();
    if (!entry) return null;
    this._redoHistory.push(entry);
    this.notifyChange();
    return entry;
  }

  redo(): ViewerUndoEntry | null {
    if (!this.canRedo) return null;
    const entry = this._redoHistory.pop();
    if (!entry) return null;
    this._undoHistory.push(entry);
    this.notifyChange();
    return entry;
  }

  clearHistory(): void {
    this._undoHistory = [];
    this._redoHistory = [];
    this.notifyChange();
  }
}
