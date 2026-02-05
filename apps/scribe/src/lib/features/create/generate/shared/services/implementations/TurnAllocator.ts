/**
 * Turn Allocation Calculator Implementation
 *
 * Calculates turn distribution across steps.
 * Extracted from SequenceGenerationService for single responsibility.
 */
import type {
  ITurnAllocator,
  TurnAllocation,
} from "../contracts/ITurnAllocator";
import type { ILOOPParameterProvider } from "../contracts/ILOOPParameterProvider";

export class TurnAllocator implements ITurnAllocator {
  constructor(private loopParams: ILOOPParameterProvider) {}

  /**
   * Allocate turns for the sequence
   */
  async allocateTurns(
    stepsToGenerate: number,
    level: number,
    turnIntensity: number
  ): Promise<TurnAllocation> {
    return this.loopParams.allocateTurns(stepsToGenerate, level, turnIntensity);
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { loopParameterProvider } from "./LOOPParameterProvider";

export const turnAllocator = new TurnAllocator(loopParameterProvider);
