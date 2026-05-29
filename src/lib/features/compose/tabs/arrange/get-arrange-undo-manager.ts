
import { ArrangeUndoManager } from './services/arrange-undo-manager';

let instance: ArrangeUndoManager | null = null;
export function getArrangeUndoManager(): ArrangeUndoManager {
  return instance ??= new ArrangeUndoManager();
}
