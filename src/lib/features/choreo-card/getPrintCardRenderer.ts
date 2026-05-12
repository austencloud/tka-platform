
import { PrintCardRenderer } from './services/PrintCardRenderer';
import { getImageComposer } from '$lib/shared/render/getImageComposer';

let instance: PrintCardRenderer | null = null;
export function getPrintCardRenderer(): PrintCardRenderer {
  return instance ??= new PrintCardRenderer(
    getImageComposer(),
  );
}
