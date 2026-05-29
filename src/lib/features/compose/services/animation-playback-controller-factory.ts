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

import { AnimationLoop } from "$lib/shared/animation-engine/services/animation-loop";
import { AnimationStateManager } from "$lib/shared/animation-engine/services/animation-state-manager";
import { createAngleCalculator } from "$lib/shared/animation-engine/services/angle-calculator";
import { EndpointCalculator } from "$lib/shared/animation-engine/services/endpoint-calculator";
import { PropInterpolator } from "$lib/shared/animation-engine/services/prop-interpolator";
import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
import { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";

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
