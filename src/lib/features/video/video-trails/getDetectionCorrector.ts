import type { IDetectionCorrector } from './services/contracts/IDetectionCorrector';
import { DetectionCorrector } from './services/implementations/DetectionCorrector';

let instance: IDetectionCorrector | null = null;
export function getDetectionCorrector(): IDetectionCorrector {
  return instance ??= new DetectionCorrector();
}
