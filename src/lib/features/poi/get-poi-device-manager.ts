import { PoiDeviceManager } from './services/poi-device-manager';
import { getOpenPixelPoiAdapter } from './get-open-pixel-poi-adapter';

let instance: PoiDeviceManager | null = null;

export function getPoiDeviceManager(): PoiDeviceManager {
  return instance ??= new PoiDeviceManager([getOpenPixelPoiAdapter()]);
}
