import { OpenPixelPoiAdapter } from './services/implementations/OpenPixelPoiAdapter';

let instance: OpenPixelPoiAdapter | null = null;
export function getOpenPixelPoiAdapter(): OpenPixelPoiAdapter {
  return instance ??= new OpenPixelPoiAdapter();
}
