import { PropInterpolator } from './services/implementations/PropInterpolator';
import { createAngleCalculator } from './services/angle-calculator';
import { getEndpointCalculator } from '$lib/features/compose/getEndpointCalculator';

let instance: PropInterpolator | null = null;
export function getPropInterpolator(): PropInterpolator {
  return instance ??= new PropInterpolator(createAngleCalculator(), getEndpointCalculator());
}
