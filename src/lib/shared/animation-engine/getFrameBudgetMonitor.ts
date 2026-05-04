
import { FrameBudgetMonitor } from './services/implementations/FrameBudgetMonitor';
import { detectDeviceTier } from './services/device-tier-detector';

let instance: FrameBudgetMonitor | null = null;
export function getFrameBudgetMonitor(): FrameBudgetMonitor {
  return instance ??= new FrameBudgetMonitor(detectDeviceTier());
}
