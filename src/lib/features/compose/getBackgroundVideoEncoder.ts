import type { IBackgroundVideoEncoder } from './services/contracts/IBackgroundVideoEncoder';
import { BackgroundVideoEncoder } from './services/implementations/BackgroundVideoEncoder';

let instance: IBackgroundVideoEncoder | null = null;
export function getBackgroundVideoEncoder(): IBackgroundVideoEncoder {
  return instance ??= new BackgroundVideoEncoder();
}
