import { EndpointCalculator } from '$lib/shared/animation-engine/services/endpoint-calculator';
import { createAngleCalculator } from '$lib/shared/animation-engine/services/angle-calculator';

let instance: EndpointCalculator | null = null;
export function getEndpointCalculator(): EndpointCalculator {
  return instance ??= new EndpointCalculator(createAngleCalculator());
}
