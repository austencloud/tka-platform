/**
 * Letter Deriver Service Implementation
 *
 * Derives letters from motion data for deep link sequences.
 * Uses motion query handler and grid mode deriver to match
 * motion configurations to their corresponding letters.
 *
 * Domain: Navigation - Letter Derivation
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { StartPositionData } from "../../../../features/create/shared/domain/models/StartPositionData";
import type { IMotionQueryHandler } from "$lib/shared/foundation/services/contracts/data/data-contracts";
import type { IGridModeDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridModeDeriver";
import type { ILetterDeriver } from "../contracts/ILetterDeriver";

export class LetterDeriver implements ILetterDeriver {
  constructor(
    private motionQueryHandler: IMotionQueryHandler | null,
    private gridModeDeriver: IGridModeDeriver | null
  ) {}

  async deriveLettersForSequence(
    sequence: SequenceData
  ): Promise<SequenceData> {
    if (!this.motionQueryHandler) {
      console.warn(
        "MotionQueryHandler not available - letters will not be derived"
      );
      return sequence;
    }

    if (!this.gridModeDeriver) {
      console.warn(
        "GridModeDeriver not available - letters will not be derived"
      );
      return sequence;
    }

    // Derive letters for all beats in the sequence
    const beatsWithLetters = (await Promise.all(
      sequence.beats.map((beat) => this.deriveLetterForBeat(beat))
    )) as BeatData[];

    // Derive letter for start position if it exists
    let updatedStartPosition: StartPositionData | null | undefined =
      sequence.startPosition;
    let updatedStartingPositionBeat: StartPositionData | undefined =
      sequence.startingPositionBeat;

    if (sequence.startPosition) {
      // Cast is safe - we pass StartPositionData so we get StartPositionData back
      updatedStartPosition = (await this.deriveLetterForBeat(
        sequence.startPosition
      )) as StartPositionData;
    }

    if (sequence.startingPositionBeat) {
      // Cast is safe - we pass StartPositionData so we get StartPositionData back
      updatedStartingPositionBeat = (await this.deriveLetterForBeat(
        sequence.startingPositionBeat
      )) as StartPositionData;
    }

    // Build the word from the letters
    const word = beatsWithLetters
      .map((beat) => beat.letter ?? "")
      .join("")
      .toUpperCase();

    return {
      ...sequence,
      beats: beatsWithLetters,
      word,
      ...(updatedStartPosition !== undefined &&
        updatedStartPosition !== null && {
          startPosition: updatedStartPosition,
        }),
      ...(updatedStartingPositionBeat !== undefined && {
        startingPositionBeat: updatedStartingPositionBeat,
      }),
    };
  }

  private async deriveLetterForBeat(
    beat: BeatData | StartPositionData
  ): Promise<BeatData | StartPositionData> {
    // Skip if letter is already set or if motions are missing
    if (beat.letter !== null || !beat.motions.blue || !beat.motions.red) {
      return beat;
    }

    if (!this.motionQueryHandler || !this.gridModeDeriver) {
      return beat;
    }

    try {
      // Derive the correct grid mode from the motions
      const gridMode = this.gridModeDeriver.deriveGridMode(
        beat.motions.blue,
        beat.motions.red
      );

      const letter =
        (await this.motionQueryHandler.findLetterByMotionConfiguration(
          beat.motions.blue,
          beat.motions.red,
          gridMode
        )) as BeatData["letter"];

      if (letter) {
        return { ...beat, letter };
      } else {
        // Use appropriate identifier in warning
        const identifier =
          "beatNumber" in beat ? `beat ${beat.beatNumber}` : "start position";
        console.warn(
          `Could not derive letter for ${identifier} (gridMode: ${gridMode}) - no matching pictograph found`
        );
        return beat;
      }
    } catch (error) {
      // Use appropriate identifier in warning
      const identifier =
        "beatNumber" in beat ? `beat ${beat.beatNumber}` : "start position";
      console.warn(`Failed to derive letter for ${identifier}:`, error);
      return beat;
    }
  }
}
