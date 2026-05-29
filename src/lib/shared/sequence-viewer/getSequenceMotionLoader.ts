import { SequenceMotionLoader } from './services/sequence-motion-loader';
import { getBrowseLoader } from '$lib/shared/browse/getBrowseLoader';

let instance: SequenceMotionLoader | null = null;
export function getSequenceMotionLoader(): SequenceMotionLoader {
  return instance ??= new SequenceMotionLoader(getBrowseLoader());
}
