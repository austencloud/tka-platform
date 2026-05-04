import { VideoExportOrchestrator } from './services/implementations/VideoExportOrchestrator';
import { getVideoExporter } from './getVideoExporter';
import { getCompositeVideoRenderer } from './getCompositeVideoRenderer';
import { getExportGlyphPrerenderer } from './getExportGlyphPrerenderer';
import { getBackgroundVideoEncoder } from './getBackgroundVideoEncoder';

let instance: VideoExportOrchestrator | null = null;
export function getVideoExportOrchestrator(): VideoExportOrchestrator {
  return instance ??= new VideoExportOrchestrator(
    getVideoExporter(),
    getCompositeVideoRenderer(),
    getExportGlyphPrerenderer(),
    getBackgroundVideoEncoder()
  );
}
