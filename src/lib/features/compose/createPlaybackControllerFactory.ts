/**
 * Factory function to create a NEW AnimationPlaybackController instance.
 * Use this when you need multiple independent controllers (e.g., tunnel mode with multiple sequences).
 * Each call returns a fresh controller with its own orchestrator and loop.
 */
import { AnimationStateManager } from "./services/implementations/AnimationStateManager";
import { createAngleCalculator } from "./services/angle-calculator";
import { EndpointCalculator } from "./services/implementations/EndpointCalculator";
import { PropInterpolator } from "./services/implementations/PropInterpolator";
import { SequenceAnimationOrchestrator } from "./services/implementations/SequenceAnimationOrchestrator";
import { AnimationLoop } from "./services/implementations/AnimationLoop";
import { AnimationPlaybackController } from "./services/implementations/AnimationPlaybackController";

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
