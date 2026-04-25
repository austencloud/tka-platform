import type { IAngleMathCalculator } from '$lib/shared/3d/services/contracts/IAngleMathCalculator';
import { AngleMathCalculator } from '$lib/shared/3d/services/implementations/AngleMathCalculator';

let instance: IAngleMathCalculator | null = null;

export function getAngleMath3D(): IAngleMathCalculator {
  return instance ??= new AngleMathCalculator();
}
