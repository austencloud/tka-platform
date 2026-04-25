import type { IAnimationPlaybackControllerFactory } from './services/contracts/IAnimationPlaybackControllerFactory';
import { AnimationPlaybackControllerFactory } from './services/implementations/AnimationPlaybackControllerFactory';
import { getSequenceLoopabilityChecker } from './getSequenceLoopabilityChecker';

let instance: IAnimationPlaybackControllerFactory | null = null;
export function getAnimationPlaybackControllerFactory(): IAnimationPlaybackControllerFactory {
  return instance ??= new AnimationPlaybackControllerFactory(getSequenceLoopabilityChecker());
}
