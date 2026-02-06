/**
 * Turn Allocation Calculator Interface
 *
 * Calculates turn distribution across steps based on level and turn intensity.
 */

export interface TurnAllocation {
  blue: (number | "fl")[];
  red: (number | "fl")[];
}

export interface ITurnAllocator {
  /**
   * Allocate turns for a sequence
   * @param stepsToGenerate - Number of steps to generate
   * @param level - Difficulty level (1-3)
   * @param turnIntensity - Turn intensity (0-3)
   * @returns Promise resolving to blue and red turn allocations
   */
  allocateTurns(
    stepsToGenerate: number,
    level: number,
    turnIntensity: number
  ): Promise<TurnAllocation>;
}
