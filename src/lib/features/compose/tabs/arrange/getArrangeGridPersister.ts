import type { IArrangeGridPersister } from './services/contracts/IArrangeGridPersister';
import { ArrangeGridPersister } from './services/implementations/ArrangeGridPersister';

let instance: IArrangeGridPersister | null = null;
export function getArrangeGridPersister(): IArrangeGridPersister {
  return instance ??= new ArrangeGridPersister();
}
