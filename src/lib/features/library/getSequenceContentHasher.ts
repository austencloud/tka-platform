import { SequenceContentHasher } from './services/implementations/SequenceContentHasher';

let instance: SequenceContentHasher | null = null;
export function getSequenceContentHasher(): SequenceContentHasher {
  return instance ??= new SequenceContentHasher();
}
