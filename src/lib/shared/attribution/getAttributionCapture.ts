import { AttributionCapture } from './services/implementations/AttributionCapture';

let instance: AttributionCapture | null = null;
export function getAttributionCapture(): AttributionCapture {
  return instance ??= new AttributionCapture();
}
