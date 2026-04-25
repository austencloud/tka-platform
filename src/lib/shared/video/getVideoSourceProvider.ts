import type { IVideoSourceProvider } from './services/contracts/IVideoSourceProvider';
import { VideoSourceProvider } from './services/implementations/VideoSourceProvider';

let instance: IVideoSourceProvider | null = null;
export function getVideoSourceProvider(): IVideoSourceProvider {
  return instance ??= new VideoSourceProvider();
}
