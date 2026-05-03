import { AngleMathCalculator } from '$lib/shared/3d/services/implementations/AngleMathCalculator';

let instance: AngleMathCalculator | null = null;

export function getAngleMath3D(): AngleMathCalculator {
  return instance ??= new AngleMathCalculator();
}
