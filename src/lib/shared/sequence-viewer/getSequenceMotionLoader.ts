import { SequenceMotionLoader } from './services/implementations/SequenceMotionLoader';
import { getBrowseLoader } from '$lib/shared/browse/getBrowseLoader';

let instance: SequenceMotionLoader | null = null;
export function getSequenceMotionLoader(): SequenceMotionLoader {
  return instance ??= new SequenceMotionLoader(getBrowseLoader());
}
