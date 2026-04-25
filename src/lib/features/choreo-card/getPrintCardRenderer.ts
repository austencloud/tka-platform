import type { IPrintCardRenderer } from './services/contracts/IPrintCardRenderer';
import { PrintCardRenderer } from './services/implementations/PrintCardRenderer';
import { getImageComposer } from '$lib/shared/render/getImageComposer';
import { getCardBackDomRenderer } from './getCardBackDomRenderer';
import { getInfoCardCanvasRenderer } from './getInfoCardCanvasRenderer';
import { getSequenceToEntryConverter } from './getSequenceToEntryConverter';
import { getLOOPExplainer } from './getLOOPExplainer';

let instance: IPrintCardRenderer | null = null;
export function getPrintCardRenderer(): IPrintCardRenderer {
  return instance ??= new PrintCardRenderer(
    getImageComposer(),
    getCardBackDomRenderer(),
    getInfoCardCanvasRenderer(),
    getSequenceToEntryConverter(),
    getLOOPExplainer(),
  );
}
