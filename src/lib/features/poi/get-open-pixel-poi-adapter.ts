import { OpenPixelPoiAdapter } from './services/open-pixel-poi-adapter';

let instance: OpenPixelPoiAdapter | null = null;
export function getOpenPixelPoiAdapter(): OpenPixelPoiAdapter {
  return instance ??= new OpenPixelPoiAdapter();
}
