import type { IVideoTrailsExporter } from './services/contracts/IVideoTrailsExporter';
import { VideoTrailsExporter } from './services/implementations/VideoTrailsExporter';

let instance: IVideoTrailsExporter | null = null;
export function getVideoTrailsExporter(): IVideoTrailsExporter {
  return instance ??= new VideoTrailsExporter();
}
