
import { StanceOptimizer } from './services/stance-optimizer';
import { getStanceSimulator } from './get-stance-simulator';

let instance: StanceOptimizer | null = null;
export function getStanceOptimizer(): StanceOptimizer {
  return instance ??= new StanceOptimizer(getStanceSimulator());
}
