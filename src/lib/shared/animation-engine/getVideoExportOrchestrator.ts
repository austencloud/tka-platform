import { VideoExportOrchestrator } from '$lib/features/compose/services/implementations/VideoExportOrchestrator';
import { getVideoExporter } from './getVideoExporter';
import { getCompositeVideoRenderer } from '$lib/shared/animation-engine/getCompositeVideoRenderer';
import { getExportGlyphPrerenderer } from '$lib/shared/animation-engine/getExportGlyphPrerenderer';
import { getBackgroundVideoEncoder } from '$lib/shared/animation-engine/getBackgroundVideoEncoder';

let instance: VideoExportOrchestrator | null = null;
export function getVideoExportOrchestrator(): VideoExportOrchestrator {
  return instance ??= new VideoExportOrchestrator(
    getVideoExporter(),
    getCompositeVideoRenderer(),
    getExportGlyphPrerenderer(),
    getBackgroundVideoEncoder()
  );
}
