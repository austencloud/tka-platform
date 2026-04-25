import type { IMotionCalculator } from './services/contracts/IMotionCalculator';
import { MotionCalculator } from './services/implementations/MotionCalculator';
import { getAngleMathCalculator } from './getAngleMathCalculator';
import { getOrientationMapper } from './getOrientationMapper';

let instance: IMotionCalculator | null = null;
export function getMotionCalculator3D(): IMotionCalculator {
  return instance ??= new MotionCalculator(getAngleMathCalculator(), getOrientationMapper());
}
