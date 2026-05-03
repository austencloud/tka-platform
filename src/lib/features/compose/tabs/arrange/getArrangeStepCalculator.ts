import { ArrangeStepCalculator } from './services/implementations/ArrangeStepCalculator';

let instance: ArrangeStepCalculator | null = null;
export function getArrangeStepCalculator(): ArrangeStepCalculator {
  return instance ??= new ArrangeStepCalculator();
}
