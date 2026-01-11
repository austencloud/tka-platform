import type { FishMarineLife } from "../../domain/models/DeepOceanModels";

/**
 * IFishPropulsionCalculator - Calculates forward thrust from tail motion
 *
 * Real fish propulsion comes from the tail sweeping laterally through water.
 * Thrust peaks when the tail crosses the center line (fastest lateral velocity).
 * This creates a natural connection between tail animation and actual movement.
 */
export interface IFishPropulsionCalculator {
  /**
   * Calculate instantaneous forward thrust from tail oscillation
   * @param fish - The fish entity with swim phase and tail parameters
   * @returns Thrust multiplier (0-1+) to apply to base speed
   */
  calculateThrust(fish: FishMarineLife): number;

  /**
   * Calculate the target speed based on current swim intensity
   * Combines base speed with thrust from tail motion
   * @param fish - The fish entity
   * @returns Target speed in pixels/second
   */
  calculateTargetSpeed(fish: FishMarineLife): number;

  /**
   * Get instantaneous tail velocity for physics calculations
   * @param fish - The fish entity
   * @returns Object with lateral and angular velocity components
   */
  getTailVelocity(fish: FishMarineLife): {
    lateral: number;
    angular: number;
  };
}
