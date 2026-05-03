import { ExportGlyphPrerenderer } from './services/implementations/ExportGlyphPrerenderer';
import { getSvgImageConverter } from '$lib/shared/foundation/getSvgImageConverter';

let instance: ExportGlyphPrerenderer | null = null;
export function getExportGlyphPrerenderer(): ExportGlyphPrerenderer {
  return instance ??= new ExportGlyphPrerenderer(getSvgImageConverter());
}
