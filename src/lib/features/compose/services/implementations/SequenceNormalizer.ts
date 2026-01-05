/**
 * Sequence Normalization Service
 *
 * Handles normalization of sequence data for consistent consumption by UI components.
 * Always returns StartPositionData (never BeatData) for start positions.
 */

import { injectable } from "inversify";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  ISequenceNormalizer,
  NormalizedSequenceData,
} from "../contracts/ISequenceNormalizer";
import type { BeatData } from "../../../create/shared/domain/models/BeatData";
import type { StartPositionData } from "../../../create/shared/domain/models/StartPositionData";
import { createStartPositionData } from "../../../create/shared/domain/factories/createStartPositionData";

@injectable()
export class SequenceNormalizer implements ISequenceNormalizer {
  /**
   * Normalize sequence data by separating start position from beats array.
   *
   * Handles three storage patterns:
   * 1. startPosition field (modern, uses StartPositionData)
   * 2. startingPositionBeat field (legacy, may need conversion)
   * 3. Mixed in beats array (oldest, beatNumber: 0)
   *
   * Always returns StartPositionData, converting legacy BeatData if needed.
   */
  separateBeatsFromStartPosition(
    sequence: SequenceData
  ): NormalizedSequenceData {
    // Pattern 1: Modern approach - separate startPosition field (already StartPositionData)
    if (sequence.startPosition) {
      return {
        beats: sequence.beats || [],
        startPosition: sequence.startPosition,
      };
    }

    // Pattern 2: Legacy approach - startingPositionBeat field (may need conversion)
    if (sequence.startingPositionBeat) {
      return {
        beats: sequence.beats || [],
        startPosition: sequence.startingPositionBeat,
      };
    }

    // Pattern 3: Oldest approach - beat 0 is mixed in the beats array
    const allBeats = sequence.beats || [];

    // Find legacy start position (beatNumber === 0)
    const legacyStartPos = allBeats.find(
      (beat) => beat.beatNumber === 0
    ) as BeatData | undefined;

    // Filter out start position from beats array (keep only actual beats)
    const beats = allBeats.filter((beat) => beat.beatNumber !== 0);

    // Convert legacy BeatData to StartPositionData if found
    const startPosition: StartPositionData | null = legacyStartPos
      ? this.convertBeatToStartPosition(legacyStartPos)
      : null;

    return {
      beats,
      startPosition,
    };
  }

  /**
   * Convert legacy BeatData (beatNumber: 0) to proper StartPositionData
   */
  private convertBeatToStartPosition(beat: BeatData): StartPositionData {
    return createStartPositionData({
      id: beat.id || `start-${Date.now()}`,
      letter: beat.letter ?? null,
      gridPosition: beat.endPosition ?? beat.startPosition ?? null,
      motions: beat.motions,
    });
  }
}
