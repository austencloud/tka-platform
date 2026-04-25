import type { IFrameBudgetMonitor } from './services/contracts/IFrameBudgetMonitor';
import { FrameBudgetMonitor } from './services/implementations/FrameBudgetMonitor';
import { getDeviceTierDetector } from './getDeviceTierDetector';

let instance: IFrameBudgetMonitor | null = null;
export function getFrameBudgetMonitor(): IFrameBudgetMonitor {
  return instance ??= new FrameBudgetMonitor(getDeviceTierDetector().detect());
}
