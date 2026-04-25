import type { IPoiImageLibrary } from './services/contracts/IPoiImageLibrary';
import { PoiImageLibrary } from './services/implementations/PoiImageLibrary';

let instance: IPoiImageLibrary | null = null;
export function getPoiImageLibrary(): IPoiImageLibrary {
  return instance ??= new PoiImageLibrary();
}
