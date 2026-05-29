import { VideoTrailsExporter } from './services/video-trails-exporter';

let instance: VideoTrailsExporter | null = null;
export function getVideoTrailsExporter(): VideoTrailsExporter {
  return instance ??= new VideoTrailsExporter();
}
