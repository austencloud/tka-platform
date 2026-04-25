import type { IAttributionPersister } from './services/contracts/IAttributionPersister';
import { AttributionPersister } from './services/implementations/AttributionPersister';
import { getAttributionCapture } from './getAttributionCapture';

let instance: IAttributionPersister | null = null;
export function getAttributionPersister(): IAttributionPersister {
  return instance ??= new AttributionPersister(getAttributionCapture());
}
