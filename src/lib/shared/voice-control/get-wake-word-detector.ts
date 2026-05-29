import { WakeWordDetector } from './services/wake-word-detector';

let instance: WakeWordDetector | null = null;
export function getWakeWordDetector(): WakeWordDetector {
  return instance ??= new WakeWordDetector();
}
