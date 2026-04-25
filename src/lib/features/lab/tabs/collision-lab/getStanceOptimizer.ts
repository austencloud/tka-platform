import type { IStanceOptimizer } from './services/contracts/IStanceOptimizer';
import { StanceOptimizer } from './services/implementations/StanceOptimizer';
import { getStanceSimulator } from './getStanceSimulator';

let instance: IStanceOptimizer | null = null;
export function getStanceOptimizer(): IStanceOptimizer {
  return instance ??= new StanceOptimizer(getStanceSimulator());
}
