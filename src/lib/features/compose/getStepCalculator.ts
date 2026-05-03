import { StepCalculator } from './services/implementations/StepCalculator';

let instance: StepCalculator | null = null;
export function getStepCalculator(): StepCalculator {
  return instance ??= new StepCalculator();
}
