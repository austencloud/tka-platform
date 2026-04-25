import type { ISequenceLocalCache } from './services/contracts/ISequenceLocalCache';
import { SequenceLocalCache } from './services/implementations/SequenceLocalCache';

let instance: ISequenceLocalCache | null = null;
export function getSequenceLocalCache(): ISequenceLocalCache {
  return instance ??= new SequenceLocalCache();
}
