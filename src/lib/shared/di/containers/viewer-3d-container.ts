/**
 * Viewer 3D Container
 *
 * Services specific to the standalone 3D sequence viewer (the one launched
 * from the sequence viewer modal — not the museum, village, or festival).
 *
 * Scope today: snapshot-based undo/redo scoped to the viewer session.
 *
 * Why its own container:
 * - Undo/redo is a UI concern of the viewer, not a 3D-engine primitive.
 * - Keeps 3d-engine-container purely infrastructural so every 3D surface
 *   can depend on the engine without pulling in viewer UI state.
 */

import { createContainer } from "iti";

import { Viewer3DUndoManager } from "$lib/shared/3d/services/implementations/Viewer3DUndoManager";

export function createViewer3DContainer() {
  return createContainer().add({
    viewer3DUndoManager: () => new Viewer3DUndoManager(),
  });
}

export type Viewer3DContainer = ReturnType<typeof createViewer3DContainer>;
