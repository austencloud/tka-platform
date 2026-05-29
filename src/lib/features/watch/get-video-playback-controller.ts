import { VideoPlaybackController } from './services/VideoPlaybackController';

let instance: VideoPlaybackController | null = null;
export function getVideoPlaybackController(): VideoPlaybackController {
  return instance ??= new VideoPlaybackController();
}
