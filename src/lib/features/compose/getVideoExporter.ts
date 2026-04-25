import type { IVideoExporter } from './services/contracts/IVideoExporter';
import { VideoExporter } from './services/implementations/VideoExporter';

let instance: IVideoExporter | null = null;
export function getVideoExporter(): IVideoExporter {
  return instance ??= new VideoExporter();
}
