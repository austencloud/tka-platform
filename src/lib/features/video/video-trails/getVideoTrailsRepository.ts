import type { IVideoTrailsRepository } from './services/contracts/IVideoTrailsRepository';
import { VideoTrailsRepository } from './services/implementations/VideoTrailsRepository';

let instance: IVideoTrailsRepository | null = null;
export function getVideoTrailsRepository(): IVideoTrailsRepository {
  return instance ??= new VideoTrailsRepository();
}
