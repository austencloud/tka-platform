import { PoiImageLibrary } from './services/implementations/PoiImageLibrary';

let instance: PoiImageLibrary | null = null;
export function getPoiImageLibrary(): PoiImageLibrary {
  return instance ??= new PoiImageLibrary();
}
