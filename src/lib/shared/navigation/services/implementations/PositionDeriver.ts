/**
 * Position Deriver Service Implementation
 *
 * Derives start/end positions from motion data for deep link sequences.
 * Uses grid position deriver to calculate positions based on hand locations.
 *
 * Domain: Navigation - Position Derivation
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { StartPositionData } from "../../../../features/create/shared/domain/models/StartPositionData";
import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { IPositionDeriver } from "../contracts/IPositionDeriver";

export class PositionDeriver implements IPositionDeriver {
  constructor(private gridPositionDeriver: IGridPositionDeriver | null) {}

  async derivePositionsForSequence(
    sequence: SequenceData
  ): Promise<SequenceData> {
    if (!this.gridPositionDeriver) {
      console.warn(
        "GridPositionDeriver not available - positions will not be derived"
      );
      return sequence;
    }

    // Derive positions for all beats in the sequence
    const beatsWithPositions = sequence.beats.map((beat) =>
      this.derivePositionsForBeat(beat)
    ) as BeatData[];

    // Derive positions for start position if it exists
    let updatedStartPosition: StartPositionData | null | undefined =
      sequence.startPosition;
    let updatedStartingPositionBeat: StartPositionData | undefined =
      sequence.startingPositionBeat;

    if (sequence.startPosition) {
      // Cast is safe - we pass StartPositionData so we get StartPositionData back
      updatedStartPosition = this.derivePositionsForBeat(
        sequence.startPosition
      ) as StartPositionData;
    }

    if (sequence.startingPositionBeat) {
      // Cast is safe - we pass StartPositionData so we get StartPositionData back
      updatedStartingPositionBeat = this.derivePositionsForBeat(
        sequence.startingPositionBeat
      ) as StartPositionData;
    }

    return {
      ...sequence,
      beats: beatsWithPositions,
      ...(updatedStartPosition !== undefined &&
        updatedStartPosition !== null && {
          startPosition: updatedStartPosition,
        }),
      ...(updatedStartingPositionBeat !== undefined && {
        startingPositionBeat: updatedStartingPositionBeat,
      }),
    };
  }

  private derivePositionsForBeat(
    beat: BeatData | StartPositionData
  ): BeatData | StartPositionData {
    // Skip if positions are already set or if motions are missing
    if (
      (beat.startPosition !== null && beat.endPosition !== null) ||
      !beat.motions.blue ||
      !beat.motions.red
    ) {
      return beat;
    }

    if (!this.gridPositionDeriver) {
      return beat;
    }

    try {
      // Calculate start position from starting hand locations
      const startPosition: GridPosition =
        this.gridPositionDeriver.getGridPositionFromLocations(
          beat.motions.blue.startLocation,
          beat.motions.red.startLocation
        );

      // Calculate end position from ending hand locations
      const endPosition: GridPosition =
        this.gridPositionDeriver.getGridPositionFromLocations(
          beat.motions.blue.endLocation,
          beat.motions.red.endLocation
        );

      return {
        ...beat,
        startPosition,
        endPosition,
      };
    } catch (error) {
      // Use appropriate identifier in warning
      const identifier =
        "beatNumber" in beat ? `beat ${beat.beatNumber}` : "start position";
      console.warn(`Failed to derive positions for ${identifier}:`, error);
      return beat;
    }
  }
}
