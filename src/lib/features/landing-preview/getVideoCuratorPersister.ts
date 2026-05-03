
import { VideoCuratorPersister } from './services/implementations/VideoCuratorPersister';

let instance: VideoCuratorPersister | null = null;
export function getVideoCuratorPersister(): VideoCuratorPersister {
  return instance ??= new VideoCuratorPersister();
}
