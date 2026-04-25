import type { IPropStateInterpolator } from './services/contracts/IPropStateInterpolator';
import { PropStateInterpolator } from './services/implementations/PropStateInterpolator';
import { getAngleMathCalculator } from './getAngleMathCalculator';
import { getOrientationMapper } from './getOrientationMapper';
import { getMotionCalculator3D } from './getMotionCalculator3D';

let instance: IPropStateInterpolator | null = null;
export function getPropStateInterpolator(): IPropStateInterpolator {
  return instance ??= new PropStateInterpolator(
    getAngleMathCalculator(),
    getOrientationMapper(),
    getMotionCalculator3D()
  );
}
