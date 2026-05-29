import { PoiDeviceManager } from './services/implementations/PoiDeviceManager';
import { getOpenPixelPoiAdapter } from './getOpenPixelPoiAdapter';

let instance: PoiDeviceManager | null = null;

export function getPoiDeviceManager(): PoiDeviceManager {
  return instance ??= new PoiDeviceManager([getOpenPixelPoiAdapter()]);
}
