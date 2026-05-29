import { VideoExporter } from './services/video-exporter';

let instance: VideoExporter | null = null;
export function getVideoExporter(): VideoExporter {
  return instance ??= new VideoExporter();
}
