import { EndpointCalculator } from './services/implementations/EndpointCalculator';
import { getAngleCalculator } from './getAngleCalculator';
import { getMotionCalculator } from './getMotionCalculator';

let instance: EndpointCalculator | null = null;
export function getEndpointCalculator(): EndpointCalculator {
  return instance ??= new EndpointCalculator(getAngleCalculator(), getMotionCalculator());
}
