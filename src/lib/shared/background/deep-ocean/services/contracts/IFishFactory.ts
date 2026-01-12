import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { FishMarineLife } from "../../domain/models/DeepOceanModels";

/**
 * Contract for fish creation and initialization
 *
 * Handles species assignment, body generation, fin/tail creation,
 * and initial positioning of new fish.
 */
export interface IFishFactory {
  /**
   * Create a single fish with all properties initialized
   * @param spawnOnScreen - If true, fish spawns within visible area instead of off-screen
   */
  createFish(dimensions: Dimensions, useSpineChain?: boolean, spawnOnScreen?: boolean): FishMarineLife;

  /**
   * Initialize a population of fish
   * @param spawnOnScreen - If true, fish spawn within visible area instead of off-screen
   */
  initializeFish(
    dimensions: Dimensions,
    count: number,
    useSpineChain?: boolean,
    spawnOnScreen?: boolean
  ): FishMarineLife[];
}
