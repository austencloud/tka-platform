import { VideoTrailsRepository } from './services/video-trails-repository';

let instance: VideoTrailsRepository | null = null;
export function getVideoTrailsRepository(): VideoTrailsRepository {
  return instance ??= new VideoTrailsRepository();
}
