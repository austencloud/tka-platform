import { TrailCapturer } from './services/implementations/TrailCapturer';

let instance: TrailCapturer | null = null;
export function getTrailCapturer(): TrailCapturer {
  return instance ??= new TrailCapturer();
}
