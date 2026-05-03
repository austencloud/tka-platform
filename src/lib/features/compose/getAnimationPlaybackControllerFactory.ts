import { AnimationPlaybackControllerFactory } from './services/implementations/AnimationPlaybackControllerFactory';
import { getSequenceLoopabilityChecker } from './getSequenceLoopabilityChecker';

let instance: AnimationPlaybackControllerFactory | null = null;
export function getAnimationPlaybackControllerFactory(): AnimationPlaybackControllerFactory {
  return instance ??= new AnimationPlaybackControllerFactory(getSequenceLoopabilityChecker());
}
