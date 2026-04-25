import type { IPoiConstraintValidator } from './services/contracts/IPoiConstraintValidator';
import { PoiConstraintValidator } from './services/implementations/PoiConstraintValidator';
import { getPoiGravityOrientationDeriver } from './getPoiGravityOrientationDeriver';

let instance: IPoiConstraintValidator | null = null;
export function getPoiConstraintValidator(): IPoiConstraintValidator {
  return instance ??= new PoiConstraintValidator(getPoiGravityOrientationDeriver());
}
