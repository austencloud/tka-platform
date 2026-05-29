import { PropInterpolator } from './services/prop-interpolator';
import { createAngleCalculator } from './services/angle-calculator';
import { getEndpointCalculator } from '$lib/shared/animation-engine/getEndpointCalculator';

let instance: PropInterpolator | null = null;
export function getPropInterpolator(): PropInterpolator {
  return instance ??= new PropInterpolator(createAngleCalculator(), getEndpointCalculator());
}
