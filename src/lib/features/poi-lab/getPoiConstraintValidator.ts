import { PoiConstraintValidator } from './services/implementations/PoiConstraintValidator';
import { getPoiGravityOrientationDeriver } from './getPoiGravityOrientationDeriver';

let instance: PoiConstraintValidator | null = null;
export function getPoiConstraintValidator(): PoiConstraintValidator {
  return instance ??= new PoiConstraintValidator(getPoiGravityOrientationDeriver());
}
