import { ImagePatternLoader } from './services/implementations/ImagePatternLoader';

let instance: ImagePatternLoader | null = null;
export function getImagePatternLoader(): ImagePatternLoader {
  return instance ??= new ImagePatternLoader();
}
