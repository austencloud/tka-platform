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
import { SequenceAnimationOrchestrator } from "$lib/shared/animation-engine/services/sequence-animation-orchestrator";
import { AnimationPlaybackController } from "$lib/shared/animation-engine/services/animation-playback-controller";
import type { AnimationVisibilityStateManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

/**
 * @param visibilityManager Optional per-instance visibility manager. When
 * provided, the orchestrator's prop interpolation (path shape / motion-aware
 * paths / speed) reads from it instead of the global singleton — required so a
 * scoped surface (e.g. the landing spinner's ephemeral AnimationScope) has its
 * props follow the SAME path shape its path-line overlay draws. Without it the
 * props interpolate against global settings while the overlay uses the scope,
 * so the two disagree.
 */
export function createAnimationPlaybackController(
  visibilityManager?: AnimationVisibilityStateManager
): AnimationPlaybackController {
  const animationStateManager = new AnimationStateManager();
  const animationLoop = new AnimationLoop();

  const orchestrator = new SequenceAnimationOrchestrator(
    animationStateManager
  );
  if (visibilityManager) {
    orchestrator.setVisibilityManager(visibilityManager);
  }

  return new AnimationPlaybackController(orchestrator, animationLoop);
}
