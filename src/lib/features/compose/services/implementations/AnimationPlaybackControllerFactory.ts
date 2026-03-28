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

import type { IAnimationPlaybackController } from "../contracts/IAnimationPlaybackController";
import type { IAnimationPlaybackControllerFactory } from "../contracts/IAnimationPlaybackControllerFactory";
import type { ISequenceLoopabilityChecker } from "../contracts/ISequenceLoopabilityChecker";
import { AnimationLoop } from "./AnimationLoop";
import { AnimationStateManager } from "./AnimationStateManager";
import { AngleCalculator } from "./AngleCalculator";
import { MotionCalculator } from "./MotionCalculator";
import { EndpointCalculator } from "./EndpointCalculator";
import { PropInterpolator } from "./PropInterpolator";
import { StepCalculator } from "./StepCalculator";
import { SequenceAnimationOrchestrator } from "./SequenceAnimationOrchestrator";
import { AnimationPlaybackController } from "./AnimationPlaybackController";

export class AnimationPlaybackControllerFactory
  implements IAnimationPlaybackControllerFactory
{
  constructor(
    private readonly loopabilityChecker: ISequenceLoopabilityChecker
  ) {}

  create(): IAnimationPlaybackController {
    // Each instance gets its own stateful services so animations don't interfere.
    // Calculators are stateless — safe to create fresh lightweight instances.
    const angleCalculator = new AngleCalculator();
    const motionCalculator = new MotionCalculator();
    const endpointCalculator = new EndpointCalculator(
      angleCalculator,
      motionCalculator
    );
    const propInterpolator = new PropInterpolator(
      angleCalculator,
      endpointCalculator
    );

    const animationStateManager = new AnimationStateManager();
    const stepCalculator = new StepCalculator();
    const animationLoop = new AnimationLoop();

    const orchestrator = new SequenceAnimationOrchestrator(
      animationStateManager,
      stepCalculator,
      propInterpolator
    );

    return new AnimationPlaybackController(
      orchestrator,
      animationLoop,
      this.loopabilityChecker
    );
  }
}
