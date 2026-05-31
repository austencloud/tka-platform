import { AnimationPlaybackController } from '$lib/shared/animation-engine/services/animation-playback-controller';
import { getSequenceAnimationOrchestrator } from './get-sequence-animation-orchestrator';
import { getAnimationLoop } from '$lib/shared/animation-engine/get-animation-loop';

let instance: AnimationPlaybackController | null = null;
export function getAnimationPlaybackController(): AnimationPlaybackController {
  return instance ??= new AnimationPlaybackController(
    getSequenceAnimationOrchestrator(),
    getAnimationLoop()
  );
}
