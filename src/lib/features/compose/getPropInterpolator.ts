import { PropInterpolator } from './services/implementations/PropInterpolator';
import { getAngleCalculator } from './getAngleCalculator';
import { getEndpointCalculator } from './getEndpointCalculator';

let instance: PropInterpolator | null = null;
export function getPropInterpolator(): PropInterpolator {
  return instance ??= new PropInterpolator(getAngleCalculator(), getEndpointCalculator());
}
