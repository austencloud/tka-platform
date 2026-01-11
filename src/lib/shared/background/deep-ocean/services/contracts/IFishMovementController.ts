import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { FishMarineLife } from "../../domain/models/DeepOceanModels";

/**
 * Contract for fish movement and behavior state machine
 *
 * Handles behavior transitions (cruising, turning, darting, schooling),
 * movement application, and edge awareness.
 */
export interface IFishMovementController {
  /**
   * Apply behavior-specific movement to a fish
   */
  applyBehavior(
    fish: FishMarineLife,
    deltaSeconds: number,
    frameMultiplier: number,
    dimensions: Dimensions
  ): void;

  /**
   * Transition to next behavior state
   * @param fish - The fish to transition
   * @param dimensions - Screen dimensions for edge detection
   * @param nearbyFish - Other fish for social behavior decisions
   * @param animationTime - Current animation time for context
   */
  transitionBehavior(
    fish: FishMarineLife,
    dimensions: Dimensions,
    nearbyFish?: FishMarineLife[],
    animationTime?: number
  ): void;

  /**
   * Check if fish is off screen (for removal)
   */
  isOffScreen(fish: FishMarineLife, dimensions: Dimensions): boolean;

  /**
   * Get edge proximity (0-1, 1 = at edge)
   */
  getEdgeProximity(fish: FishMarineLife, dimensions: Dimensions): number;
}
