import type { IEndpointDetector } from './services/contracts/IEndpointDetector';
import { LedThresholdDetector } from './services/implementations/LedThresholdDetector';

let instance: IEndpointDetector | null = null;
export function getLedThresholdDetector(): IEndpointDetector {
  return instance ??= new LedThresholdDetector();
}
