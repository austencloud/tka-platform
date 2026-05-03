import { FrameExtractor } from './services/implementations/FrameExtractor';

let instance: FrameExtractor | null = null;
export function getFrameExtractor(): FrameExtractor {
  return instance ??= new FrameExtractor();
}
