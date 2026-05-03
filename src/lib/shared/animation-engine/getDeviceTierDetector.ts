import { DeviceTierDetector } from './services/implementations/DeviceTierDetector';

let instance: DeviceTierDetector | null = null;
export function getDeviceTierDetector(): DeviceTierDetector {
  return instance ??= new DeviceTierDetector();
}
