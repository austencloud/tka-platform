import { PoiSequenceValidator } from './services/implementations/PoiSequenceValidator';

let instance: PoiSequenceValidator | null = null;
export function getPoiSequenceValidator(): PoiSequenceValidator {
  return instance ??= new PoiSequenceValidator();
}
