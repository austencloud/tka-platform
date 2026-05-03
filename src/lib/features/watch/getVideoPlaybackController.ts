import { VideoPlaybackController } from './services/implementations/VideoPlaybackController';

let instance: VideoPlaybackController | null = null;
export function getVideoPlaybackController(): VideoPlaybackController {
  return instance ??= new VideoPlaybackController();
}
