/**
 * IUFOMovementController - Handles UFO movement and wandering logic
 */

import type { Dimensions } from "../../../shared/domain/types/background-types";
import type { UFO, UFOConfig, EventPosition } from "../domain/ufo-types";
import type { IUFOMoodManager } from "./IUFOMoodManager";

export interface MovementContext {
  ufo: UFO;
  config: UFOConfig;
  dimensions: Dimensions;
  speedMult: number;
  moodManager: IUFOMoodManager;
  eventProvider: (() => EventPosition | null) | null;
}

export type MovementResult =
  | { action: "continue" }
  | { action: "arrived_at_target" }
  | { action: "start_pause" }
  | { action: "start_chasing"; event: EventPosition }
  | { action: "start_tracking"; event: EventPosition }
  | { action: "near_miss_handled" };

export interface IUFOMovementController {
  /**
   * Update UFO wandering movement for one frame
   * Returns an action indicating what the caller should do next
   */
  updateWandering(ctx: MovementContext): MovementResult;

  /**
   * React to a near-miss event (something passed too close)
   */
  reactToNearMiss(ctx: MovementContext, event: EventPosition): void;

  /**
   * Reset wandering state with new random turn rate
   */
  resetWanderingState(ufo: UFO, config: UFOConfig): void;

  /**
   * Calculate shortest angle difference between two angles
   */
  angleDiff(from: number, to: number): number;
}
