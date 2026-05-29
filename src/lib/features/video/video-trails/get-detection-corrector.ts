import * as detectionCorrector from './services/detection-corrector';

export function getDetectionCorrector(): typeof detectionCorrector {
  return detectionCorrector;
}
