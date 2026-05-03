import { PropStateInterpolator } from './services/implementations/PropStateInterpolator';
import { getAngleMathCalculator } from './getAngleMathCalculator';
import { getOrientationMapper } from './getOrientationMapper';
import { getMotionCalculator3D } from './getMotionCalculator3D';

let instance: PropStateInterpolator | null = null;
export function getPropStateInterpolator(): PropStateInterpolator {
  return instance ??= new PropStateInterpolator(
    getAngleMathCalculator(),
    getOrientationMapper(),
    getMotionCalculator3D()
  );
}
