import { AttributionPersister } from './services/implementations/AttributionPersister';
import { getAttributionCapture } from './getAttributionCapture';

let instance: AttributionPersister | null = null;
export function getAttributionPersister(): AttributionPersister {
  return instance ??= new AttributionPersister(getAttributionCapture());
}
