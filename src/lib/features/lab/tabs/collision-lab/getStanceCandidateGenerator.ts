import type { ICandidateGenerator } from './services/contracts/ICandidateGenerator';
import { CandidateGenerator } from './services/implementations/CandidateGenerator';
import { getStanceOptimizer } from './getStanceOptimizer';

let instance: ICandidateGenerator | null = null;
export function getStanceCandidateGenerator(): ICandidateGenerator {
  return instance ??= new CandidateGenerator(getStanceOptimizer());
}
