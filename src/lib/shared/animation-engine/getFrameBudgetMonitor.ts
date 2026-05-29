
import { FrameBudgetMonitor } from './services/frame-budget-monitor';
import { detectDeviceTier } from './services/device-tier-detector';

let instance: FrameBudgetMonitor | null = null;
export function getFrameBudgetMonitor(): FrameBudgetMonitor {
  return instance ??= new FrameBudgetMonitor(detectDeviceTier());
}
