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
   */
  createFish(dimensions: Dimensions, useSpineChain?: boolean): FishMarineLife;

  /**
   * Initialize a population of fish
   */
  initializeFish(
    dimensions: Dimensions,
    count: number,
    useSpineChain?: boolean
  ): FishMarineLife[];
}
