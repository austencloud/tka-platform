import type { ISequenceContentHasher } from './services/contracts/ISequenceContentHasher';
import { SequenceContentHasher } from './services/implementations/SequenceContentHasher';

let instance: ISequenceContentHasher | null = null;
export function getSequenceContentHasher(): ISequenceContentHasher {
  return instance ??= new SequenceContentHasher();
}
