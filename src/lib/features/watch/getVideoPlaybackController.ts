import type { IVideoPlaybackController } from './services/contracts/IVideoPlaybackController';
import { VideoPlaybackController } from './services/implementations/VideoPlaybackController';

let instance: IVideoPlaybackController | null = null;
export function getVideoPlaybackController(): IVideoPlaybackController {
  return instance ??= new VideoPlaybackController();
}
