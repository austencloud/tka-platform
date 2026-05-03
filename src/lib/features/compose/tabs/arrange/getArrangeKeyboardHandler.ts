
import { ArrangeKeyboardHandler } from './services/implementations/ArrangeKeyboardHandler';

let instance: ArrangeKeyboardHandler | null = null;
export function getArrangeKeyboardHandler(): ArrangeKeyboardHandler {
  return instance ??= new ArrangeKeyboardHandler();
}
