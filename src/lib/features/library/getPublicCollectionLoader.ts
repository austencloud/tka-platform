import type { IPublicCollectionLoader } from './services/contracts/IPublicCollectionLoader';
import { PublicCollectionLoader } from './services/implementations/PublicCollectionLoader';

let instance: IPublicCollectionLoader | null = null;
export function getPublicCollectionLoader(): IPublicCollectionLoader {
  return instance ??= new PublicCollectionLoader();
}
