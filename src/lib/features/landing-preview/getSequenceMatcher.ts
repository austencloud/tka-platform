import { SequenceMatcher } from './services/SequenceMatcher';

let instance: SequenceMatcher | null = null;
export function getSequenceMatcher(): SequenceMatcher {
  return instance ??= new SequenceMatcher();
}
