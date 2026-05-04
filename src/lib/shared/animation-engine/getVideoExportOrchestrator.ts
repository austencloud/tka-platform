import { VideoExportOrchestrator } from '$lib/features/compose/services/implementations/VideoExportOrchestrator';
import { getVideoExporter } from './getVideoExporter';
import { getCompositeVideoRenderer } from '$lib/features/compose/getCompositeVideoRenderer';
import { getExportGlyphPrerenderer } from '$lib/features/compose/getExportGlyphPrerenderer';
import { getBackgroundVideoEncoder } from '$lib/features/compose/getBackgroundVideoEncoder';

let instance: VideoExportOrchestrator | null = null;
export function getVideoExportOrchestrator(): VideoExportOrchestrator {
  return instance ??= new VideoExportOrchestrator(
    getVideoExporter(),
    getCompositeVideoRenderer(),
    getExportGlyphPrerenderer(),
    getBackgroundVideoEncoder()
  );
}
