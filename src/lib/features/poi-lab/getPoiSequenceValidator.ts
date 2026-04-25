import type { IPoiSequenceValidator } from './services/contracts/IPoiSequenceValidator';
import { PoiSequenceValidator } from './services/implementations/PoiSequenceValidator';
import { getPoiConstraintValidator } from './getPoiConstraintValidator';

let instance: IPoiSequenceValidator | null = null;
export function getPoiSequenceValidator(): IPoiSequenceValidator {
  return instance ??= new PoiSequenceValidator(getPoiConstraintValidator());
}
