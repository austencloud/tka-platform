import type { IPoiDeviceAdapter } from './services/contracts/IPoiDeviceAdapter';
import { OpenPixelPoiAdapter } from './services/implementations/OpenPixelPoiAdapter';

let instance: IPoiDeviceAdapter | null = null;
export function getOpenPixelPoiAdapter(): IPoiDeviceAdapter {
  return instance ??= new OpenPixelPoiAdapter();
}
