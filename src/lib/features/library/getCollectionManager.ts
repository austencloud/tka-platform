import type { ICollectionManager } from './services/contracts/ICollectionManager';
import { CollectionManager } from './services/implementations/CollectionManager';

let instance: ICollectionManager | null = null;
export function getCollectionManager(): ICollectionManager {
  return instance ??= new CollectionManager();
}
