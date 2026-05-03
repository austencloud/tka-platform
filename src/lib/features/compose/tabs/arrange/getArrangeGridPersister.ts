import { ArrangeGridPersister } from './services/implementations/ArrangeGridPersister';

let instance: ArrangeGridPersister | null = null;
export function getArrangeGridPersister(): ArrangeGridPersister {
  return instance ??= new ArrangeGridPersister();
}
