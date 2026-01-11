import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { SpineChain } from "../../physics/SpineChain";

/**
 * Contract for spine chain physics management
 *
 * Handles organic swimming animation via spine chains -
 * initialization, physics updates, and joint synchronization.
 */
export interface IFishSpineController {
  /**
   * Initialize spine chain for a fish
   * Sets up spine joints and attaches to fish entity
   */
  initializeSpineChain(fish: FishMarineLife): void;

  /**
   * Update propulsion based on tail physics
   * Should be called BEFORE movement to update fish.speed based on thrust
   * @param fish - The fish entity
   * @param deltaSeconds - Time since last frame in seconds
   */
  updatePropulsion(fish: FishMarineLife, deltaSeconds: number): void;

  /**
   * Update spine chain physics for organic swimming
   */
  updateSpineChain(
    fish: FishMarineLife,
    deltaSeconds: number,
    frameMultiplier: number
  ): void;

  /**
   * Get the spine chain for a fish (for external access)
   */
  getSpineChain(fish: FishMarineLife): SpineChain | undefined;

  /**
   * Remove spine chain reference when fish is removed
   */
  removeSpineChain(fish: FishMarineLife): void;
}
