import type { IArrangeUndoManager } from './services/contracts/IArrangeUndoManager';
import { ArrangeUndoManager } from './services/implementations/ArrangeUndoManager';

let instance: IArrangeUndoManager | null = null;
export function getArrangeUndoManager(): IArrangeUndoManager {
  return instance ??= new ArrangeUndoManager();
}
