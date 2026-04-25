import type { IAngleMathCalculator } from './services/contracts/IAngleMathCalculator';
import { AngleMathCalculator } from './services/implementations/AngleMathCalculator';

let instance: IAngleMathCalculator | null = null;
export function getAngleMathCalculator(): IAngleMathCalculator {
  return instance ??= new AngleMathCalculator();
}
