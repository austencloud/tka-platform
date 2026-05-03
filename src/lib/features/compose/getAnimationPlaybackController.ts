import { AnimationPlaybackController } from './services/implementations/AnimationPlaybackController';
import { getSequenceAnimationOrchestrator } from './getSequenceAnimationOrchestrator';
import { getAnimationLoop } from './getAnimationLoop';
import { getSequenceLoopabilityChecker } from './getSequenceLoopabilityChecker';

let instance: AnimationPlaybackController | null = null;
export function getAnimationPlaybackController(): AnimationPlaybackController {
  return instance ??= new AnimationPlaybackController(
    getSequenceAnimationOrchestrator(),
    getAnimationLoop(),
    getSequenceLoopabilityChecker()
  );
}
