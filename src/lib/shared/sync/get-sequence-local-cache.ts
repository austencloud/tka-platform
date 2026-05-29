import { SequenceLocalCache } from './services/sequence-local-cache';

let instance: SequenceLocalCache | null = null;
export function getSequenceLocalCache(): SequenceLocalCache {
  return instance ??= new SequenceLocalCache();
}
