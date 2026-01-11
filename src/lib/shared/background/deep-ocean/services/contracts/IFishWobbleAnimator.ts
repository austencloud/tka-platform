import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { WobbleOffset } from "../../domain/types/fish-personality-types";

/**
 * IFishWobbleAnimator - Handles expressive wobble animations for fish
 *
 * Wobbles are brief visual animations that express personality and mood,
 * similar to how the UFO system uses wobbles for character expression.
 */
export interface IFishWobbleAnimator {
  /**
   * Update wobble animation state (decay timer and intensity)
   * @param fish - The fish to update
   * @param deltaSeconds - Time since last frame
   */
  updateWobble(fish: FishMarineLife, deltaSeconds: number): void;

  /**
   * Calculate wobble offsets based on current wobble state
   * @param fish - The fish to get offsets for
   * @returns WobbleOffset with rotation, scale, and position adjustments
   */
  getWobbleOffset(fish: FishMarineLife): WobbleOffset;

  /**
   * Trigger a wobble animation on a fish
   * @param fish - The fish to wobble
   * @param wobbleType - The type of wobble to trigger
   * @param intensity - Starting intensity (0-1)
   */
  triggerWobble(
    fish: FishMarineLife,
    wobbleType: FishMarineLife["wobbleType"],
    intensity?: number
  ): void;

  /**
   * Check if a fish is currently wobbling
   * @param fish - The fish to check
   * @returns true if wobble is active
   */
  isWobbling(fish: FishMarineLife): boolean;
}
