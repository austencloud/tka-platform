import { VideoTrailsRepository } from './services/implementations/VideoTrailsRepository';

let instance: VideoTrailsRepository | null = null;
export function getVideoTrailsRepository(): VideoTrailsRepository {
  return instance ??= new VideoTrailsRepository();
}
