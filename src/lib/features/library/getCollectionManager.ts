import { CollectionManager } from './services/implementations/CollectionManager';

let instance: CollectionManager | null = null;
export function getCollectionManager(): CollectionManager {
  return instance ??= new CollectionManager();
}
