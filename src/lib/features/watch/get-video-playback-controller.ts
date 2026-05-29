import { VideoPlaybackController } from './services/video-playback-controller';

let instance: VideoPlaybackController | null = null;
export function getVideoPlaybackController(): VideoPlaybackController {
  return instance ??= new VideoPlaybackController();
}
