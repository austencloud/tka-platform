/**
 * Viewer 3D Undo Manager Contract
 *
 * Snapshot-based undo for the standalone 3D viewer. Captures four types
 * of mutations: spawn, remove, formation-apply, and spatial edits.
 *
 * Pattern mirrors features/create/shared/services/implementations/UndoManager.ts:
 * each push captures a full state snapshot; undo restores the snapshot.
 * Simpler than command-pattern for a bounded operation set.
 */

import type { FormationPreset } from "../../domain/formation";
import type { Plane } from "../../domain/enums/Plane";

/**
 * Serializable snapshot of one performer's editable state.
 * Sequences are referenced by (ownerId, sequenceId) rather than inlined.
 */
export interface PerformerSnapshot {
  id: string;
  position: { x: number; z: number };
  facingAngle: number;
  customBluePlane: Plane;
  customRedPlane: Plane;
  sequenceRef: { ownerId: string; sequenceId: string } | null;
}

/**
 * Full serializable viewer state at a point in time.
 */
export interface ViewerSnapshot {
  performers: PerformerSnapshot[];
  selectedPerformerIndex: number | null;
  activeFormation: FormationPreset | "manual";
  timestamp: number;
}

/**
 * The four mutation types that push undo entries.
 * - spawn:    a performer was added
 * - remove:   a performer was removed
 * - formation: a formation preset was applied (via smooth transition)
 * - spatial:  a position or facing edit on any performer, coalesced to 300ms
 */
export type ViewerOperationType = "spawn" | "remove" | "formation" | "spatial";

export interface ViewerUndoEntry {
  id: string;
  type: ViewerOperationType;
  beforeState: ViewerSnapshot;
  afterState?: ViewerSnapshot;
  timestamp: number;
}

export interface IViewer3DUndoManager {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly maxHistorySize: number;
  readonly undoHistory: ReadonlyArray<ViewerUndoEntry>;
  readonly redoHistory: ReadonlyArray<ViewerUndoEntry>;

  /**
   * Push a new entry with only beforeState populated. Returns the new entry's id
   * so the caller can complete it with `completeEntry(id, afterState)` once the
   * mutation lands.
   */
  pushSnapshot(type: ViewerOperationType, beforeState: ViewerSnapshot): string;

  /**
   * Fill in the afterState on an in-flight entry. Called immediately after the
   * mutation completes.
   */
  completeEntry(id: string, afterState: ViewerSnapshot): void;

  /** Pop the top undo entry onto the redo stack. Returns the entry or null. */
  undo(): ViewerUndoEntry | null;

  /** Pop the top redo entry back onto the undo stack. Returns the entry or null. */
  redo(): ViewerUndoEntry | null;

  /** Empty both stacks. */
  clearHistory(): void;

  /** Subscribe to any stack change. Returns an unsubscribe function. */
  onChange(callback: () => void): () => void;
}
