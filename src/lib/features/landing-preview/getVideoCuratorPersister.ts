import type { IVideoCuratorPersister } from './services/contracts/IVideoCuratorPersister';
import { VideoCuratorPersister } from './services/implementations/VideoCuratorPersister';

let instance: IVideoCuratorPersister | null = null;
export function getVideoCuratorPersister(): IVideoCuratorPersister {
  return instance ??= new VideoCuratorPersister();
}
