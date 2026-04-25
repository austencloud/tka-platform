import type { ICanvasRenderer } from './services/contracts/ICanvasRenderer';
import { CanvasRenderer } from './services/implementations/CanvasRenderer';

let instance: ICanvasRenderer | null = null;
export function getCanvasRenderer(): ICanvasRenderer {
  return instance ??= new CanvasRenderer();
}
