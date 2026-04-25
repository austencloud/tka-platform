import type { IAngleCalculator } from './services/contracts/IAngleCalculator';
import { AngleCalculator } from './services/implementations/AngleCalculator';

let instance: IAngleCalculator | null = null;
export function getAngleCalculator(): IAngleCalculator {
  return instance ??= new AngleCalculator();
}
