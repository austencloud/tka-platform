import { PoiSequenceValidator } from './services/poi-sequence-validator';

let instance: PoiSequenceValidator | null = null;
export function getPoiSequenceValidator(): PoiSequenceValidator {
  return instance ??= new PoiSequenceValidator();
}
