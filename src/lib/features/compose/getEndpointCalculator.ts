import { EndpointCalculator } from './services/implementations/EndpointCalculator';
import { createAngleCalculator } from './services/angle-calculator';

let instance: EndpointCalculator | null = null;
export function getEndpointCalculator(): EndpointCalculator {
  return instance ??= new EndpointCalculator(createAngleCalculator());
}
