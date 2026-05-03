import { CanvasFrameCapturer } from './services/implementations/CanvasFrameCapturer';

let instance: CanvasFrameCapturer | null = null;
export function getCanvasFrameCapturer(): CanvasFrameCapturer {
  return instance ??= new CanvasFrameCapturer();
}
