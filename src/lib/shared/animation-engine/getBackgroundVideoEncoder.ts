import { BackgroundVideoEncoder } from '$lib/shared/animation-engine/services/implementations/BackgroundVideoEncoder';

let instance: BackgroundVideoEncoder | null = null;
export function getBackgroundVideoEncoder(): BackgroundVideoEncoder {
  return instance ??= new BackgroundVideoEncoder();
}
