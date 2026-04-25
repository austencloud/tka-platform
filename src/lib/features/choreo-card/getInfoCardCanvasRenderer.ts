import type { IInfoCardCanvasRenderer } from './services/contracts/IInfoCardCanvasRenderer';
import { InfoCardCanvasRenderer } from './services/implementations/InfoCardCanvasRenderer';

let instance: IInfoCardCanvasRenderer | null = null;
export function getInfoCardCanvasRenderer(): IInfoCardCanvasRenderer {
  return instance ??= new InfoCardCanvasRenderer();
}
