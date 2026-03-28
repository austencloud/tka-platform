/**
 * Animation Playback Controller Factory Interface
 *
 * Creates independent AnimationPlaybackController instances, each with their own
 * animation engine, loop service, and state. This allows multiple animation canvases
 * on the same page (e.g. landing page "How TKA Works" and "Play With It" sections)
 * to run independently without interfering with each other.
 *
 * The singleton animationPlaybackController in the DI container is still used by
 * the main compose module. This factory is for cases where isolated instances are needed.
 */

import type { IAnimationPlaybackController } from "./IAnimationPlaybackController";

export interface IAnimationPlaybackControllerFactory {
  /**
   * Create a new, independent playback controller instance.
   * Each instance has its own animation loop, state manager, and orchestrator.
   * The caller is responsible for calling dispose() when done.
   */
  create(): IAnimationPlaybackController;
}
