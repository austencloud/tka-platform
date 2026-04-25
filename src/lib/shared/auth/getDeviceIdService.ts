import type { IDeviceIdService } from './services/contracts/IDeviceIdService';
import { DeviceIdService } from './services/implementations/DeviceIdService';

let instance: IDeviceIdService | null = null;
export function getDeviceIdService(): IDeviceIdService {
  return instance ??= new DeviceIdService();
}
