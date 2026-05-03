
import { StanceOptimizer } from './services/implementations/StanceOptimizer';
import { getStanceSimulator } from './getStanceSimulator';

let instance: StanceOptimizer | null = null;
export function getStanceOptimizer(): StanceOptimizer {
  return instance ??= new StanceOptimizer(getStanceSimulator());
}
