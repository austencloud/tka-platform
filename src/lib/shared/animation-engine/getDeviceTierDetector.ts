import type { IDeviceTierDetector } from './services/contracts/IDeviceTierDetector';
import { DeviceTierDetector } from './services/implementations/DeviceTierDetector';

let instance: IDeviceTierDetector | null = null;
export function getDeviceTierDetector(): IDeviceTierDetector {
  return instance ??= new DeviceTierDetector();
}
