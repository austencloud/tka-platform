import { MotionCalculator } from './services/implementations/MotionCalculator';
import { getAngleMathCalculator } from './getAngleMathCalculator';
import { getOrientationMapper } from './getOrientationMapper';

let instance: MotionCalculator | null = null;
export function getMotionCalculator3D(): MotionCalculator {
  return instance ??= new MotionCalculator(getAngleMathCalculator(), getOrientationMapper());
}
