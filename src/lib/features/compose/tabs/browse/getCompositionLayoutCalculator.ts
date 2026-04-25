import type { ICompositionLayoutCalculator } from './services/contracts/ICompositionLayoutCalculator';
import { CompositionLayoutCalculator } from './services/implementations/CompositionLayoutCalculator';

let instance: ICompositionLayoutCalculator | null = null;
export function getCompositionLayoutCalculator(): ICompositionLayoutCalculator {
  return instance ??= new CompositionLayoutCalculator();
}
