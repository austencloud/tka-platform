
import { ArrangeGridSerializer } from './services/implementations/ArrangeGridSerializer';

let instance: ArrangeGridSerializer | null = null;
export function getArrangeGridSerializer(): ArrangeGridSerializer {
  return instance ??= new ArrangeGridSerializer();
}
