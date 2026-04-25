import type { IStepCalculator } from './services/contracts/IStepCalculator';
import { StepCalculator } from './services/implementations/StepCalculator';

let instance: IStepCalculator | null = null;
export function getStepCalculator(): IStepCalculator {
  return instance ??= new StepCalculator();
}
