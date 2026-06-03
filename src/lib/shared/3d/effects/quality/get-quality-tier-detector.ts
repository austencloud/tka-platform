import { QualityTierDetector } from './quality-tier-detector';

let instance: QualityTierDetector | null = null;
export function getQualityTierDetector(): QualityTierDetector {
  return instance ??= new QualityTierDetector();
}
