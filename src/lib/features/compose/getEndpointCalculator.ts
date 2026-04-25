import type { IEndpointCalculator } from './services/contracts/IEndpointCalculator';
import { EndpointCalculator } from './services/implementations/EndpointCalculator';
import { getAngleCalculator } from './getAngleCalculator';
import { getMotionCalculator } from './getMotionCalculator';

let instance: IEndpointCalculator | null = null;
export function getEndpointCalculator(): IEndpointCalculator {
  return instance ??= new EndpointCalculator(getAngleCalculator(), getMotionCalculator());
}
