import type { ICompositionThumbnailResolver } from './services/contracts/ICompositionThumbnailResolver';
import { CompositionThumbnailResolver } from './services/implementations/CompositionThumbnailResolver';

let instance: ICompositionThumbnailResolver | null = null;
export function getCompositionThumbnailResolver(): ICompositionThumbnailResolver {
  return instance ??= new CompositionThumbnailResolver();
}
