import type { IAttributionCapture } from './services/contracts/IAttributionCapture';
import { AttributionCapture } from './services/implementations/AttributionCapture';

let instance: IAttributionCapture | null = null;
export function getAttributionCapture(): IAttributionCapture {
  return instance ??= new AttributionCapture();
}
