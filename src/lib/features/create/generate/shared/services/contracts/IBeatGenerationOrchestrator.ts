/**
 * Beat Generation Orchestrator Interface
 *
 * Orchestrates the generation of multiple beats for a sequence.
 */
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { PropContinuity } from "../../domain/models/generate-models";
import type { TurnAllocation } from "./ITurnAllocator";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export interface BeatGenerationOptions {
  level: number;
  turnAllocation: TurnAllocation;
  propContinuity: PropContinuity;
  blueRotationDirection: string;
  redRotationDirection: string;
  gridMode: GridMode;
  propType: PropType;
  /** Optional: Required end position for this beat (used for last beat with end position constraint) */
  requiredEndPosition?: string;
}

export interface IBeatGenerationOrchestrator {
  /**
   * Generate multiple beats for a sequence
   * @param sequence - Current sequence (start position + any existing beats)
   * @param count - Number of beats to generate
   * @param options - Generation options
   * @returns Promise resolving to array of generated beats
   */
  generateBeats(
    sequence: (BeatData | StartPositionData)[],
    count: number,
    options: BeatGenerationOptions
  ): Promise<BeatData[]>;

  /**
   * Generate a single next beat
   * @param sequence - Current sequence
   * @param options - Generation options
   * @param turnBlue - Blue turn value for this beat
   * @param turnRed - Red turn value for this beat
   * @returns Promise resolving to the next beat
   */
  generateNextBeat(
    sequence: (BeatData | StartPositionData)[],
    options: BeatGenerationOptions,
    turnBlue: number | "fl",
    turnRed: number | "fl"
  ): Promise<BeatData>;
}
