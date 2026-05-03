
import { PrintCardRenderer } from './services/implementations/PrintCardRenderer';
import { getImageComposer } from '$lib/shared/render/getImageComposer';
import { getCardBackDomRenderer } from './getCardBackDomRenderer';
import { getInfoCardCanvasRenderer } from './getInfoCardCanvasRenderer';
import { getSequenceToEntryConverter } from './getSequenceToEntryConverter';
import { getLOOPExplainer } from './getLOOPExplainer';

let instance: PrintCardRenderer | null = null;
export function getPrintCardRenderer(): PrintCardRenderer {
  return instance ??= new PrintCardRenderer(
    getImageComposer(),
    getCardBackDomRenderer(),
    getInfoCardCanvasRenderer(),
    getSequenceToEntryConverter(),
    getLOOPExplainer(),
  );
}
