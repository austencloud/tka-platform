import { PoiConstraintValidator } from './services/implementations/PoiConstraintValidator';

let instance: PoiConstraintValidator | null = null;
export function getPoiConstraintValidator(): PoiConstraintValidator {
  return instance ??= new PoiConstraintValidator();
}
