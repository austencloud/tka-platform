import { SequenceMatcher } from './services/implementations/SequenceMatcher';

let instance: SequenceMatcher | null = null;
export function getSequenceMatcher(): SequenceMatcher {
  return instance ??= new SequenceMatcher();
}
