/**
 * Factory function to create a NEW AnimationPlaybackController instance.
 * Use this when you need multiple independent controllers (e.g., tunnel mode with multiple sequences).
 * Each call returns a fresh controller with its own orchestrator and loop.
 */
import { AnimationStateManager } from "./services/animation-state-manager";
import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
import { AnimationLoop } from "./services/animation-loop";
import { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";

export function createPlaybackControllerFactory(): AnimationPlaybackController {
  const stateManager = new AnimationStateManager();

  const orchestrator = new SequenceAnimationOrchestrator(
    stateManager
  );
  const loop = new AnimationLoop();

  return new AnimationPlaybackController(orchestrator, loop);
}
