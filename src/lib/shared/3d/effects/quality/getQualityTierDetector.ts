import { QualityTierDetector } from './QualityTierDetector';

let instance: QualityTierDetector | null = null;
export function getQualityTierDetector(): QualityTierDetector {
  return instance ??= new QualityTierDetector();
}
