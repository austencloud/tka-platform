import { VideoSourceProvider } from './services/video-source-provider';

let instance: VideoSourceProvider | null = null;
export function getVideoSourceProvider(): VideoSourceProvider {
  return instance ??= new VideoSourceProvider();
}
