import type { ITrailCapturer } from './services/contracts/ITrailCapturer';
import { TrailCapturer } from './services/implementations/TrailCapturer';

let instance: ITrailCapturer | null = null;
export function getTrailCapturer(): ITrailCapturer {
  return instance ??= new TrailCapturer();
}
