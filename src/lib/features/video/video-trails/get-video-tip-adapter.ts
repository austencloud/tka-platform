import { VideoTipAdapter } from './services/video-tip-adapter';

let instance: VideoTipAdapter | null = null;
export function getVideoTipAdapter(): VideoTipAdapter {
  return instance ??= new VideoTipAdapter();
}
