/**
 * Turn Allocation Calculator Implementation
 *
 * Calculates turn distribution across beats.
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
    beatsToGenerate: number,
    level: number,
    turnIntensity: number
  ): Promise<TurnAllocation> {
    return this.loopParams.allocateTurns(beatsToGenerate, level, turnIntensity);
  }
}
