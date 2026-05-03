import { WakeWordDetector } from './services/implementations/WakeWordDetector';

let instance: WakeWordDetector | null = null;
export function getWakeWordDetector(): WakeWordDetector {
  return instance ??= new WakeWordDetector();
}
