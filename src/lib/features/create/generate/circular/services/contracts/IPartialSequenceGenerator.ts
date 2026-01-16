/**
 * Partial Sequence Generator Interface
 *
 * Generates partial sequences for circular mode (LOOP preparation).
 */
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { GenerationOptions } from "$lib/features/create/generate/shared/domain/models/generate-models";
import type { SliceSize } from "../../domain/models/circular-models";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface IPartialSequenceGenerator {
  /**
   * Generate a partial sequence ending at a specific position
   * Used for circular mode LOOP generation
   * @param startPos - Start grid position
   * @param endPos - Required end grid position
   * @param sliceSize - Halved or quartered
   * @param options - Generation options
   * @returns Promise resolving to partial sequence (start position + intermediate steps + final beat)
   */
  generatePartialSequence(
    startPos: GridPosition,
    endPos: GridPosition,
    sliceSize: SliceSize,
    options: GenerationOptions
  ): Promise<StepData[]>;
}
