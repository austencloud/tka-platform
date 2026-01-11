import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { WobbleOffset } from "../../domain/types/fish-personality-types";

/**
 * Contract for fish animation and behavior
 */
export interface IFishAnimator {
  /**
   * Initialize fish population
   */
  initializeFish(
    dimensions: Dimensions,
    count: number
  ): Promise<FishMarineLife[]>;

  /**
   * Create a single fish with behavior properties
   */
  createFish(dimensions: Dimensions): FishMarineLife;

  /**
   * Update all fish positions, behaviors, and animations
   */
  updateFish(
    fish: FishMarineLife[],
    dimensions: Dimensions,
    frameMultiplier: number,
    animationTime: number
  ): FishMarineLife[];

  /**
   * Get optimal fish count for quality level
   */
  getFishCount(quality: string): number;

  /**
   * Schedule a fish spawn
   */
  scheduleSpawn(spawnTime: number): void;

  /**
   * Process pending spawns and return new fish
   */
  processPendingSpawns(
    dimensions: Dimensions,
    currentTime: number
  ): FishMarineLife[];

  /**
   * Get wobble offset for rendering
   * Returns rotation, scale, and position adjustments for expressive animations
   */
  getWobbleOffset(fish: FishMarineLife): WobbleOffset;
}
