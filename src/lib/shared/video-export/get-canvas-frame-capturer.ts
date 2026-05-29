import { CanvasFrameCapturer } from './services/canvas-frame-capturer';

let instance: CanvasFrameCapturer | null = null;
export function getCanvasFrameCapturer(): CanvasFrameCapturer {
  return instance ??= new CanvasFrameCapturer();
}
