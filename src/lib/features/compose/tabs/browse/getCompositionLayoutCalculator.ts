
import { CompositionLayoutCalculator } from './services/implementations/CompositionLayoutCalculator';

let instance: CompositionLayoutCalculator | null = null;
export function getCompositionLayoutCalculator(): CompositionLayoutCalculator {
  return instance ??= new CompositionLayoutCalculator();
}
