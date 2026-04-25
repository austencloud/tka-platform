import type { IEndpointDetector } from './services/contracts/IEndpointDetector';
import { ColorEndpointDetector } from './services/implementations/ColorEndpointDetector';

let instance: IEndpointDetector | null = null;
export function getColorEndpointDetector(): IEndpointDetector {
  return instance ??= new ColorEndpointDetector();
}
