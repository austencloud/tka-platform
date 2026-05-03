import { SequenceConverter } from './services/implementations/SequenceConverter';

let instance: SequenceConverter | null = null;
export function getSequenceConverter(): SequenceConverter {
  return instance ??= new SequenceConverter();
}
