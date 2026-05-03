import { VideoTipAdapter } from './services/implementations/VideoTipAdapter';

let instance: VideoTipAdapter | null = null;
export function getVideoTipAdapter(): VideoTipAdapter {
  return instance ??= new VideoTipAdapter();
}
