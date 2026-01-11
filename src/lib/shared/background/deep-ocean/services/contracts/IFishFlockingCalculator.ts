import type { FishMarineLife } from "../../domain/models/DeepOceanModels";

/**
 * Contract for fish flocking behavior (Boids algorithm)
 *
 * Handles school formation, separation/alignment/cohesion forces,
 * and steering application for schooling fish.
 */
export interface IFishFlockingCalculator {
  /**
   * Apply flocking forces to all schooling fish
   */
  applyFlockingForces(fish: FishMarineLife[], deltaSeconds: number): void;

  /**
   * Form initial schools from fish population
   */
  formSchools(fish: FishMarineLife[]): void;
}
