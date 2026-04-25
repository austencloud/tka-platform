import type { IArrangeStepCalculator } from './services/contracts/IArrangeStepCalculator';
import { ArrangeStepCalculator } from './services/implementations/ArrangeStepCalculator';

let instance: IArrangeStepCalculator | null = null;
export function getArrangeStepCalculator(): IArrangeStepCalculator {
  return instance ??= new ArrangeStepCalculator();
}
