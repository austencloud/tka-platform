import { PoiOptionFilterDecorator } from './services/implementations/PoiOptionFilterDecorator';
import { getPoiConstraintValidator } from './getPoiConstraintValidator';

let instance: PoiOptionFilterDecorator | null = null;
export function getPoiOptionFilterDecorator(): PoiOptionFilterDecorator {
  return instance ??= new PoiOptionFilterDecorator(getPoiConstraintValidator());
}
