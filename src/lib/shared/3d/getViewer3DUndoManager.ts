import { Viewer3DUndoManager } from './services/implementations/Viewer3DUndoManager';

let instance: Viewer3DUndoManager | null = null;
export function getViewer3DUndoManager(): Viewer3DUndoManager {
  return instance ??= new Viewer3DUndoManager();
}
