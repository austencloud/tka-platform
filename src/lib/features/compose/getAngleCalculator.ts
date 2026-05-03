import { AngleCalculator } from './services/implementations/AngleCalculator';

let instance: AngleCalculator | null = null;
export function getAngleCalculator(): AngleCalculator {
  return instance ??= new AngleCalculator();
}
