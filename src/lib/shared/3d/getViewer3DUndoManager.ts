import type { IViewer3DUndoManager } from './services/contracts/IViewer3DUndoManager';
import { Viewer3DUndoManager } from './services/implementations/Viewer3DUndoManager';

let instance: IViewer3DUndoManager | null = null;
export function getViewer3DUndoManager(): IViewer3DUndoManager {
  return instance ??= new Viewer3DUndoManager();
}
