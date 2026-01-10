/**
 * IUFOBehavior - Base interface for all UFO behavior implementations
 *
 * Each behavior handles a specific UFO state (chasing, surfing, napping, etc.)
 * with start() to initialize and update() to run the state machine.
 */

import type { BehaviorContext } from "./IUFOBehaviorRunner";
import type { UFOState } from "../domain/ufo-types";

export interface IUFOBehavior {
  /** The UFO state this behavior handles */
  readonly state: UFOState;

  /** Initialize this behavior - called when entering the state */
  start(ctx: BehaviorContext, ...args: unknown[]): void;

  /** Update the behavior state machine - called each frame while in this state */
  update(ctx: BehaviorContext): void;
}
