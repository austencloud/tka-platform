import { SequenceLocalCache } from './services/implementations/SequenceLocalCache';

let instance: SequenceLocalCache | null = null;
export function getSequenceLocalCache(): SequenceLocalCache {
  return instance ??= new SequenceLocalCache();
}
