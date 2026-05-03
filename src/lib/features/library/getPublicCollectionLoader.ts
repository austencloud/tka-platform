import { PublicCollectionLoader } from './services/implementations/PublicCollectionLoader';

let instance: PublicCollectionLoader | null = null;
export function getPublicCollectionLoader(): PublicCollectionLoader {
  return instance ??= new PublicCollectionLoader();
}
