import type { IPoiOptionFilterDecorator } from './services/contracts/IPoiOptionFilterDecorator';
import { PoiOptionFilterDecorator } from './services/implementations/PoiOptionFilterDecorator';
import { getPoiConstraintValidator } from './getPoiConstraintValidator';

let instance: IPoiOptionFilterDecorator | null = null;
export function getPoiOptionFilterDecorator(): IPoiOptionFilterDecorator {
  return instance ??= new PoiOptionFilterDecorator(getPoiConstraintValidator());
}
