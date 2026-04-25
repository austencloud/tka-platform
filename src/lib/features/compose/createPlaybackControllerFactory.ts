/**
 * Factory function to create a NEW AnimationPlaybackController instance.
 * Use this when you need multiple independent controllers (e.g., tunnel mode with multiple sequences).
 * Each call returns a fresh controller with its own orchestrator and loop.
 */
import { AnimationStateManager } from "./services/implementations/AnimationStateManager";
import { StepCalculator } from "./services/implementations/StepCalculator";
import { AngleCalculator } from "./services/implementations/AngleCalculator";
import { MotionCalculator } from "./services/implementations/MotionCalculator";
import { EndpointCalculator } from "./services/implementations/EndpointCalculator";
import { PropInterpolator } from "./services/implementations/PropInterpolator";
import { SequenceAnimationOrchestrator } from "./services/implementations/SequenceAnimationOrchestrator";
import { AnimationLoop } from "./services/implementations/AnimationLoop";
import { SequenceLoopabilityChecker } from "./services/implementations/SequenceLoopabilityChecker";
import { AnimationPlaybackController } from "./services/implementations/AnimationPlaybackController";

export function createPlaybackControllerFactory(): AnimationPlaybackController {
  const stateManager = new AnimationStateManager();
  const beatCalculator = new StepCalculator();
  const angleCalculator = new AngleCalculator();
  const motionCalculator = new MotionCalculator();
  const endpointCalculator = new EndpointCalculator(angleCalculator, motionCalculator);
  const propInterpolator = new PropInterpolator(angleCalculator, endpointCalculator);

  const orchestrator = new SequenceAnimationOrchestrator(
    stateManager,
    beatCalculator,
    propInterpolator
  );
  const loop = new AnimationLoop();
  const loopChecker = new SequenceLoopabilityChecker();

  return new AnimationPlaybackController(orchestrator, loop, loopChecker);
}
