/**
 * Animation Playback Controller Factory
 *
 * Creates independent AnimationPlaybackController instances with their own
 * animation engine stack. Each instance gets fresh copies of all stateful services
 * (AnimationLoop, AnimationStateManager, SequenceAnimationOrchestrator) so multiple
 * canvases can animate simultaneously without interfering with each other.
 *
 * Stateless services (calculators, loopability checker) are shared across instances
 * since they hold no per-animation state.
 */

import { AnimationLoop } from "$lib/shared/animation-engine/services/implementations/AnimationLoop";
import { AnimationStateManager } from "$lib/shared/animation-engine/services/implementations/AnimationStateManager";
import { createAngleCalculator } from "$lib/shared/animation-engine/services/angle-calculator";
import { EndpointCalculator } from "$lib/shared/animation-engine/services/implementations/EndpointCalculator";
import { PropInterpolator } from "$lib/shared/animation-engine/services/implementations/PropInterpolator";
import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/implementations/SequenceAnimationOrchestrator";
import { AnimationPlaybackController } from "$lib/shared/animation-engine/services/implementations/AnimationPlaybackController";

export function createAnimationPlaybackController(): AnimationPlaybackController {
  const angleCalculator = createAngleCalculator();
  const endpointCalculator = new EndpointCalculator(angleCalculator);
  const propInterpolator = new PropInterpolator(
    angleCalculator,
    endpointCalculator
  );

  const animationStateManager = new AnimationStateManager();
  const animationLoop = new AnimationLoop();

  const orchestrator = new SequenceAnimationOrchestrator(
    animationStateManager,
    propInterpolator
  );

  return new AnimationPlaybackController(orchestrator, animationLoop);
}
