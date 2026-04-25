import type { IFrameExtractor } from './services/contracts/IFrameExtractor';
import { FrameExtractor } from './services/implementations/FrameExtractor';

let instance: IFrameExtractor | null = null;
export function getFrameExtractor(): IFrameExtractor {
  return instance ??= new FrameExtractor();
}
