import { CandidateGenerator } from './services/candidate-generator';
import { getStanceOptimizer } from './get-stance-optimizer';

let instance: CandidateGenerator | null = null;
export function getStanceCandidateGenerator(): CandidateGenerator {
  return instance ??= new CandidateGenerator(getStanceOptimizer());
}
