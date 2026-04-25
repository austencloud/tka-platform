import type { IVideoCuratorLoader } from './services/contracts/IVideoCuratorLoader';
import { VideoCuratorLoader } from './services/implementations/VideoCuratorLoader';

let instance: IVideoCuratorLoader | null = null;
export function getVideoCuratorLoader(): IVideoCuratorLoader {
  return instance ??= new VideoCuratorLoader();
}
