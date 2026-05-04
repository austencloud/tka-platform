import { VideoExporter } from './services/implementations/VideoExporter';

let instance: VideoExporter | null = null;
export function getVideoExporter(): VideoExporter {
  return instance ??= new VideoExporter();
}
