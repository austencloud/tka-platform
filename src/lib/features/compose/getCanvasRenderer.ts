import { CanvasRenderer } from './services/implementations/CanvasRenderer';

let instance: CanvasRenderer | null = null;
export function getCanvasRenderer(): CanvasRenderer {
  return instance ??= new CanvasRenderer();
}
