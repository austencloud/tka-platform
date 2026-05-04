import { AttributionPersister } from './services/implementations/AttributionPersister';

let instance: AttributionPersister | null = null;
export function getAttributionPersister(): AttributionPersister {
  return instance ??= new AttributionPersister();
}
