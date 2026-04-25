import type { IExportGlyphPrerenderer } from './services/contracts/IExportGlyphPrerenderer';
import { ExportGlyphPrerenderer } from './services/implementations/ExportGlyphPrerenderer';
import { getSvgImageConverter } from '$lib/shared/foundation/getSvgImageConverter';

let instance: IExportGlyphPrerenderer | null = null;
export function getExportGlyphPrerenderer(): IExportGlyphPrerenderer {
  return instance ??= new ExportGlyphPrerenderer(getSvgImageConverter());
}
