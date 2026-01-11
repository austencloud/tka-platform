import type { FishMarineLife } from "../../domain/models/DeepOceanModels";

/**
 * Contract for fish visual animation updates
 *
 * Handles fin physics, body flex, wake trails, bioluminescence,
 * and other visual animations that don't affect movement.
 */
export interface IFishVisualUpdater {
  /**
   * Update all visual animations for a fish
   */
  updateVisuals(
    fish: FishMarineLife,
    frameMultiplier: number,
    animationTime: number
  ): void;

  /**
   * Update legacy (non-spine) body flex animation
   */
  updateBodyFlex(fish: FishMarineLife, frameMultiplier: number): void;

  /**
   * Update fin physics (spring-based animation)
   */
  updateFinPhysics(fish: FishMarineLife, frameMultiplier: number): void;
}
