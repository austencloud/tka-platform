import type { ISequenceConverter } from './services/contracts/ISequenceConverter';
import { SequenceConverter } from './services/implementations/SequenceConverter';

let instance: ISequenceConverter | null = null;
export function getSequenceConverter(): ISequenceConverter {
  return instance ??= new SequenceConverter();
}
