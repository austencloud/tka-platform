import type { IQualityTierDetector } from './contracts/IQualityTierDetector';
import { QualityTierDetector } from './QualityTierDetector';

let instance: IQualityTierDetector | null = null;
export function getQualityTierDetector(): IQualityTierDetector {
  return instance ??= new QualityTierDetector();
}
