import type { IAnimationPlaybackController } from './services/contracts/IAnimationPlaybackController';
import { AnimationPlaybackController } from './services/implementations/AnimationPlaybackController';
import { getSequenceAnimationOrchestrator } from './getSequenceAnimationOrchestrator';
import { getAnimationLoop } from './getAnimationLoop';
import { getSequenceLoopabilityChecker } from './getSequenceLoopabilityChecker';

let instance: IAnimationPlaybackController | null = null;
export function getAnimationPlaybackController(): IAnimationPlaybackController {
  return instance ??= new AnimationPlaybackController(
    getSequenceAnimationOrchestrator(),
    getAnimationLoop(),
    getSequenceLoopabilityChecker()
  );
}
