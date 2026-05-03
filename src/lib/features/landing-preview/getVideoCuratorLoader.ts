import { VideoCuratorLoader } from './services/implementations/VideoCuratorLoader';

let instance: VideoCuratorLoader | null = null;
export function getVideoCuratorLoader(): VideoCuratorLoader {
  return instance ??= new VideoCuratorLoader();
}
