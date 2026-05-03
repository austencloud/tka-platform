import { VideoSourceProvider } from './services/implementations/VideoSourceProvider';

let instance: VideoSourceProvider | null = null;
export function getVideoSourceProvider(): VideoSourceProvider {
  return instance ??= new VideoSourceProvider();
}
