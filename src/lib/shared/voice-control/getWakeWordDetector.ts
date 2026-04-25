import type { IWakeWordDetector } from './services/contracts/IWakeWordDetector';
import { WakeWordDetector } from './services/implementations/WakeWordDetector';

let instance: IWakeWordDetector | null = null;
export function getWakeWordDetector(): IWakeWordDetector {
  return instance ??= new WakeWordDetector();
}
