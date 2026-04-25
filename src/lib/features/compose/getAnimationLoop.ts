import type { IAnimationLoop } from './services/contracts/IAnimationLoop';
import { AnimationLoop } from './services/implementations/AnimationLoop';

let instance: IAnimationLoop | null = null;
export function getAnimationLoop(): IAnimationLoop {
  return instance ??= new AnimationLoop();
}
