/**
 * Build Result Transformer Contract
 *
 * Converts the sequence engine's BuildResult into the app's SequenceData.
 * Bridges the gap between the engine's minimal string-based types and the
 * app's rich enum-based domain models with embedded placement data.
 */

import type { BuildResult } from "@tka/sequence-engine/generation";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { GenerationOptions } from "../../domain/models/generate-models";

export interface IBuildResultTransformer {
  /**
   * Convert an engine BuildResult into the app's SequenceData.
   *
   * Handles:
   * - Mapping SequenceStep[] to StepData[] (string fields to enum types, placement data)
   * - Extracting StartPositionData from the first step
   * - Creating metadata via SequenceMetadataManager
   * - Applying reversal detection
   * - Detecting orientation cycles for circular sequences
   *
   * @param result - The engine's build output
   * @param options - The original generation options (for metadata, difficulty, etc.)
   * @returns Complete SequenceData ready for the workbench
   */
  convertToSequenceData(
    result: BuildResult,
    options: GenerationOptions
  ): Promise<SequenceData>;
}
