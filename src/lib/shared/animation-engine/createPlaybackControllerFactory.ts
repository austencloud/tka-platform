/**
 * Factory function to create a NEW AnimationPlaybackController instance.
 * Use this when you need multiple independent controllers (e.g., tunnel mode with multiple sequences).
 * Each call returns a fresh controller with its own orchestrator and loop.
 */
import { AnimationStateManager } from "./services/animation-state-manager";
import { createAngleCalculator } from "./services/angle-calculator";
import { EndpointCalculator } from "./services/endpoint-calculator";
import { PropInterpolator } from "./services/prop-interpolator";
import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
import { AnimationLoop } from "./services/animation-loop";
import { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";

export function createPlaybackControllerFactory(): AnimationPlaybackController {
  const stateManager = new AnimationStateManager();
  const angleCalculator = createAngleCalculator();
  const endpointCalculator = new EndpointCalculator(angleCalculator);
  const propInterpolator = new PropInterpolator(angleCalculator, endpointCalculator);

  const orchestrator = new SequenceAnimationOrchestrator(
    stateManager,
    propInterpolator
  );
  const loop = new AnimationLoop();

  return new AnimationPlaybackController(orchestrator, loop);
}
