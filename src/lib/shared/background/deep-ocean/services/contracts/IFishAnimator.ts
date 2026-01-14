import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { FishMarineLife } from "../../domain/models/DeepOceanModels";
import type { WobbleOffset } from "../../domain/types/fish-personality-types";
import type { IFishRareBehaviorHandler } from "./IFishRareBehaviorHandler";
import type { IFishHomeZoneHandler } from "./IFishHomeZoneHandler";
import type { IFishInteractionHandler } from "./IFishInteractionHandler";
import type { IFishHuntingHandler } from "./IFishHuntingHandler";

/**
 * Contract for fish animation and behavior
 */
export interface IFishAnimator {
  /**
   * Initialize fish population
   * @param spawnOnScreen - If true, fish spawn within visible area
   */
  initializeFish(
    dimensions: Dimensions,
    count: number,
    useSpineChain?: boolean,
    spawnOnScreen?: boolean
  ): Promise<FishMarineLife[]>;

  /**
   * Create a single fish with behavior properties
   * @param spawnOnScreen - If true, fish spawns within visible area
   */
  createFish(dimensions: Dimensions, useSpineChain?: boolean, spawnOnScreen?: boolean): FishMarineLife;

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

  // ============================================================================
  // Handler Accessors (for lab/testing/external access)
  // ============================================================================

  /**
   * Get the rare behavior handler for manual triggering in lab
   */
  getRareBehaviorHandler(): IFishRareBehaviorHandler;

  /**
   * Get the home zone handler for visualization in lab
   */
  getHomeZoneHandler(): IFishHomeZoneHandler;

  /**
   * Get the interaction handler for manual triggering in lab
   */
  getInteractionHandler(): IFishInteractionHandler;

  /**
   * Get the hunting handler for visualization and manual triggering in lab
   */
  getHuntingHandler(): IFishHuntingHandler;
}
