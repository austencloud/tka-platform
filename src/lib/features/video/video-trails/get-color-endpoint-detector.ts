import type { IEndpointDetector } from './services/IEndpointDetector';
import { ColorEndpointDetector } from './services/color-endpoint-detector';

let instance: IEndpointDetector | null = null;
export function getColorEndpointDetector(): IEndpointDetector {
  return instance ??= new ColorEndpointDetector();
}
