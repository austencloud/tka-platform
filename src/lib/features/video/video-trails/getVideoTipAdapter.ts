import type { IVideoTipAdapter } from './services/contracts/IVideoTipAdapter';
import { VideoTipAdapter } from './services/implementations/VideoTipAdapter';

let instance: IVideoTipAdapter | null = null;
export function getVideoTipAdapter(): IVideoTipAdapter {
  return instance ??= new VideoTipAdapter();
}
