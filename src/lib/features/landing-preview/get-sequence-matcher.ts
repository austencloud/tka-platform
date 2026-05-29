import { SequenceMatcher } from './services/sequence-matcher';

let instance: SequenceMatcher | null = null;
export function getSequenceMatcher(): SequenceMatcher {
  return instance ??= new SequenceMatcher();
}
