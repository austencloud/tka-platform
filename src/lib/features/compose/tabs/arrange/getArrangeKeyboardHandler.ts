import type { IArrangeKeyboardHandler } from './services/contracts/IArrangeKeyboardHandler';
import { ArrangeKeyboardHandler } from './services/implementations/ArrangeKeyboardHandler';

let instance: IArrangeKeyboardHandler | null = null;
export function getArrangeKeyboardHandler(): IArrangeKeyboardHandler {
  return instance ??= new ArrangeKeyboardHandler();
}
