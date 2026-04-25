import type { IMotionCalculator } from './services/contracts/IMotionCalculator';
import { MotionCalculator } from './services/implementations/MotionCalculator';

let instance: IMotionCalculator | null = null;
export function getMotionCalculator(): IMotionCalculator {
  return instance ??= new MotionCalculator();
}
