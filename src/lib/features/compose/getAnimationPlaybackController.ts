import { AnimationPlaybackController } from './services/implementations/AnimationPlaybackController';
import { getSequenceAnimationOrchestrator } from './getSequenceAnimationOrchestrator';
import { getAnimationLoop } from './getAnimationLoop';

let instance: AnimationPlaybackController | null = null;
export function getAnimationPlaybackController(): AnimationPlaybackController {
  return instance ??= new AnimationPlaybackController(
    getSequenceAnimationOrchestrator(),
    getAnimationLoop()
  );
}
