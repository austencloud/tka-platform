
import { ArrangeUndoManager } from './services/implementations/ArrangeUndoManager';

let instance: ArrangeUndoManager | null = null;
export function getArrangeUndoManager(): ArrangeUndoManager {
  return instance ??= new ArrangeUndoManager();
}
