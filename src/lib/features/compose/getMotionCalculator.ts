import { MotionCalculator } from './services/implementations/MotionCalculator';

let instance: MotionCalculator | null = null;
export function getMotionCalculator(): MotionCalculator {
  return instance ??= new MotionCalculator();
}
