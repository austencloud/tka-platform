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

import { AnimationLoop } from "./AnimationLoop";
import { AnimationStateManager } from "./AnimationStateManager";
import { createAngleCalculator } from "../angle-calculator";
import { EndpointCalculator } from "./EndpointCalculator";
import { PropInterpolator } from "./PropInterpolator";
import { SequenceAnimationOrchestrator } from "./SequenceAnimationOrchestrator";
import { AnimationPlaybackController } from "./AnimationPlaybackController";

export class AnimationPlaybackControllerFactory
{

  create(): AnimationPlaybackController {
    // Each instance gets its own stateful services so animations don't interfere.
    // Calculators are stateless - safe to create fresh lightweight instances.
    const angleCalculator = createAngleCalculator();
    const endpointCalculator = new EndpointCalculator(
      angleCalculator
    );
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

    return new AnimationPlaybackController(
      orchestrator,
      animationLoop
    );
  }
}
