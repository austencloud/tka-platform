
import { FrameBudgetMonitor } from './services/implementations/FrameBudgetMonitor';
import { getDeviceTierDetector } from './getDeviceTierDetector';

let instance: FrameBudgetMonitor | null = null;
export function getFrameBudgetMonitor(): FrameBudgetMonitor {
  return instance ??= new FrameBudgetMonitor(getDeviceTierDetector().detect());
}
