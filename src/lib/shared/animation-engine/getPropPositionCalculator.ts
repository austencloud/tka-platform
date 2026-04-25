import type { IPropPositionCalculator } from './services/contracts/IPropPositionCalculator';
import { PropPositionCalculator } from './services/implementations/PropPositionCalculator';

let instance: IPropPositionCalculator | null = null;
export function getPropPositionCalculator(): IPropPositionCalculator {
  return instance ??= new PropPositionCalculator();
}
