import type { IVideoExportOrchestrator } from './services/contracts/IVideoExportOrchestrator';
import { VideoExportOrchestrator } from './services/implementations/VideoExportOrchestrator';
import { getVideoExporter } from './getVideoExporter';
import { getCanvasRenderer } from './getCanvasRenderer';
import { getFileDownloader } from '$lib/shared/foundation/getFileDownloader';
import { getCompositeVideoRenderer } from './getCompositeVideoRenderer';
import { getExportGlyphPrerenderer } from './getExportGlyphPrerenderer';
import { getBackgroundVideoEncoder } from './getBackgroundVideoEncoder';

let instance: IVideoExportOrchestrator | null = null;
export function getVideoExportOrchestrator(): IVideoExportOrchestrator {
  return instance ??= new VideoExportOrchestrator(
    getVideoExporter(),
    getCanvasRenderer(),
    getFileDownloader(),
    getCompositeVideoRenderer(),
    getExportGlyphPrerenderer(),
    getBackgroundVideoEncoder()
  );
}
