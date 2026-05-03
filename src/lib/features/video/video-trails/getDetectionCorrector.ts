import { DetectionCorrector } from './services/implementations/DetectionCorrector';

let instance: DetectionCorrector | null = null;
export function getDetectionCorrector(): DetectionCorrector {
  return instance ??= new DetectionCorrector();
}
