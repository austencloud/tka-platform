import type { IPropInterpolator } from './services/contracts/IPropInterpolator';
import { PropInterpolator } from './services/implementations/PropInterpolator';
import { getAngleCalculator } from './getAngleCalculator';
import { getEndpointCalculator } from './getEndpointCalculator';

let instance: IPropInterpolator | null = null;
export function getPropInterpolator(): IPropInterpolator {
  return instance ??= new PropInterpolator(getAngleCalculator(), getEndpointCalculator());
}
