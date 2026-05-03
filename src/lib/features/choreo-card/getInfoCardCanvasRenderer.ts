
import { InfoCardCanvasRenderer } from './services/implementations/InfoCardCanvasRenderer';

let instance: InfoCardCanvasRenderer | null = null;
export function getInfoCardCanvasRenderer(): InfoCardCanvasRenderer {
  return instance ??= new InfoCardCanvasRenderer();
}
