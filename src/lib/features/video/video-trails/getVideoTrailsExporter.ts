import { VideoTrailsExporter } from './services/implementations/VideoTrailsExporter';

let instance: VideoTrailsExporter | null = null;
export function getVideoTrailsExporter(): VideoTrailsExporter {
  return instance ??= new VideoTrailsExporter();
}
