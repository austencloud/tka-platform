import type { ICanvasFrameCapturer } from './services/contracts/ICanvasFrameCapturer';
import { CanvasFrameCapturer } from './services/implementations/CanvasFrameCapturer';

let instance: ICanvasFrameCapturer | null = null;
export function getCanvasFrameCapturer(): ICanvasFrameCapturer {
  return instance ??= new CanvasFrameCapturer();
}
