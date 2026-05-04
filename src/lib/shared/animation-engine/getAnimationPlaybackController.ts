import { AnimationPlaybackController } from '$lib/shared/animation-engine/services/implementations/AnimationPlaybackController';
import { getSequenceAnimationOrchestrator } from './getSequenceAnimationOrchestrator';
import { getAnimationLoop } from '$lib/shared/animation-engine/getAnimationLoop';

let instance: AnimationPlaybackController | null = null;
export function getAnimationPlaybackController(): AnimationPlaybackController {
  return instance ??= new AnimationPlaybackController(
    getSequenceAnimationOrchestrator(),
    getAnimationLoop()
  );
}
