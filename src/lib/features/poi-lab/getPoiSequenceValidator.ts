import { PoiSequenceValidator } from './services/implementations/PoiSequenceValidator';
import { getPoiConstraintValidator } from './getPoiConstraintValidator';

let instance: PoiSequenceValidator | null = null;
export function getPoiSequenceValidator(): PoiSequenceValidator {
  return instance ??= new PoiSequenceValidator(getPoiConstraintValidator());
}
