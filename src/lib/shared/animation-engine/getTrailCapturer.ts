import { TrailCapturer } from '$lib/shared/animation-engine/services/implementations/TrailCapturer';

let instance: TrailCapturer | null = null;
export function getTrailCapturer(): TrailCapturer {
  return instance ??= new TrailCapturer();
}
