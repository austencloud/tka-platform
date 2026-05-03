import { DeviceIdService } from './services/implementations/DeviceIdService';

let instance: DeviceIdService | null = null;
export function getDeviceIdService(): DeviceIdService {
  return instance ??= new DeviceIdService();
}
