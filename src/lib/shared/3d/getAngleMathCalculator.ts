import { AngleMathCalculator } from './services/implementations/AngleMathCalculator';

let instance: AngleMathCalculator | null = null;
export function getAngleMathCalculator(): AngleMathCalculator {
  return instance ??= new AngleMathCalculator();
}
