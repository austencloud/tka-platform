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

// IViewer3DUndoManager interface retired — Viewer3DUndoManager class is the contract now.
