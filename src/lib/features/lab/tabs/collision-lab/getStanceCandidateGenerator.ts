import { CandidateGenerator } from './services/implementations/CandidateGenerator';
import { getStanceOptimizer } from './getStanceOptimizer';

let instance: CandidateGenerator | null = null;
export function getStanceCandidateGenerator(): CandidateGenerator {
  return instance ??= new CandidateGenerator(getStanceOptimizer());
}
