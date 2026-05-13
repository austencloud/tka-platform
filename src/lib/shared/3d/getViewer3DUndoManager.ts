import { Viewer3DUndoManager } from "@austencloud/scene-3d";

let instance: Viewer3DUndoManager | null = null;
export function getViewer3DUndoManager(): Viewer3DUndoManager {
  return instance ??= new Viewer3DUndoManager();
}
