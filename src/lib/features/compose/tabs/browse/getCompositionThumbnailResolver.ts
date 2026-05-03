import { CompositionThumbnailResolver } from './services/implementations/CompositionThumbnailResolver';

let instance: CompositionThumbnailResolver | null = null;
export function getCompositionThumbnailResolver(): CompositionThumbnailResolver {
  return instance ??= new CompositionThumbnailResolver();
}
