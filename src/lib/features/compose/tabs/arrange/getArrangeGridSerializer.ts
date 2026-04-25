import type { IArrangeGridSerializer } from './services/contracts/IArrangeGridSerializer';
import { ArrangeGridSerializer } from './services/implementations/ArrangeGridSerializer';

let instance: IArrangeGridSerializer | null = null;
export function getArrangeGridSerializer(): IArrangeGridSerializer {
  return instance ??= new ArrangeGridSerializer();
}
