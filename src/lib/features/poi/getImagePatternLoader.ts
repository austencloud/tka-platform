import type { IImagePatternLoader } from './services/contracts/IImagePatternLoader';
import { ImagePatternLoader } from './services/implementations/ImagePatternLoader';

let instance: IImagePatternLoader | null = null;
export function getImagePatternLoader(): IImagePatternLoader {
  return instance ??= new ImagePatternLoader();
}
