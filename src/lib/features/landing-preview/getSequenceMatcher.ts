import type { ISequenceMatcher } from './services/contracts/ISequenceMatcher';
import { SequenceMatcher } from './services/implementations/SequenceMatcher';

let instance: ISequenceMatcher | null = null;
export function getSequenceMatcher(): ISequenceMatcher {
  return instance ??= new SequenceMatcher();
}
