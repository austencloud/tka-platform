import { ExportGlyphPrerenderer } from '$lib/shared/animation-engine/services/export-glyph-prerenderer';
import { getSvgImageConverter } from '$lib/shared/foundation/getSvgImageConverter';

let instance: ExportGlyphPrerenderer | null = null;
export function getExportGlyphPrerenderer(): ExportGlyphPrerenderer {
  return instance ??= new ExportGlyphPrerenderer(getSvgImageConverter());
}
