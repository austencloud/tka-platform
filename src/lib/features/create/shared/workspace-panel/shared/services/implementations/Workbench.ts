/**
 * Simplified Workbench Service
 *
 * Focused service combining all essential workbench functionality.
 * Follows the same simplification pattern as OptionPickerService.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import { createPictographData } from "$lib/shared/pictograph/shared/domain/factories/createPictographData";
import { updateSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { TYPES } from "$lib/shared/inversify/types";
import { inject, injectable } from "inversify";
import { createBeatData } from "../../../../domain/factories/createBeatData";
import type { BeatData } from "../../../../domain/models/BeatData";
import type { StartPositionData } from "../../../../domain/models/StartPositionData";
import type { IPersistenceService } from "../../../../services/contracts/IPersister";
import type { ISequenceRepository } from "../../../../services/contracts/ISequenceRepository";
import type { IWorkbench } from "../contracts/IWorkbench";

@injectable()
export class Workbench implements IWorkbench {
  constructor(
    @inject(TYPES.ISequenceRepository)
    private sequenceService: ISequenceRepository,
    @inject(TYPES.IPersistenceService)
    private persistenceService: IPersistenceService
  ) {}

  // ============================================================================
  // CORE WORKBENCH OPERATIONS
  // ============================================================================

  /**
   * Handle beat click interaction
   */
  handleBeatClick(beatIndex: number, sequence: SequenceData | null): boolean {
    // Simple logic: always allow selection if sequence exists and index is valid
    if (!sequence || beatIndex < 0 || beatIndex >= sequence.beats.length) {
      return false;
    }
    return true;
  }

  /**
   * Edit a beat with default pictograph data
   */
  editBeat(beatIndex: number, sequence: SequenceData): BeatData {
    if (beatIndex < 0 || beatIndex >= sequence.beats.length) {
      throw new Error(`Invalid beat index: ${beatIndex}`);
    }

    const originalBeat = sequence.beats[beatIndex];
    const defaultPictographData = createPictographData({ letter: Letter.A });

    return createBeatData({
      ...originalBeat,
      ...defaultPictographData, // Spread PictographData properties since BeatData extends PictographData
      isBlank: false,
    });
  }

  /**
   * Clear a beat (make it blank)
   */
  clearBeat(beatIndex: number, sequence: SequenceData): BeatData {
    if (beatIndex < 0 || beatIndex >= sequence.beats.length) {
      throw new Error(`Invalid beat index: ${beatIndex}`);
    }

    const originalBeat = sequence.beats[beatIndex];

    return createBeatData({
      ...originalBeat,
      isBlank: true,
      // Reset pictograph properties to blank state
      letter: null,
      startPosition: null,
      endPosition: null,
      motions: {},
    });
  }

  /**
   * Add a beat to a sequence
   */
  async addBeat(
    sequenceId: string,
    beatData?: Partial<BeatData>
  ): Promise<SequenceData> {
    try {
      const sequence = await this.sequenceService.getSequence(sequenceId);
      if (!sequence) {
        throw new Error(`Sequence ${sequenceId} not found`);
      }

      const newBeat = createBeatData({
        isBlank: true,
        ...beatData, // Spread any provided beat data (which may include PictographData properties)
      });

      const updatedSequence = updateSequenceData(sequence, {
        beats: [...sequence.beats, newBeat],
      });

      await this.persistenceService.saveSequence(updatedSequence);
      return updatedSequence;
    } catch (error) {
      console.error("Failed to add beat:", error);
      throw new Error(
        `Failed to add beat: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Set construction start position
   */
  async setConstructionStartPosition(
    sequenceId: string,
    startPosition: StartPositionData
  ): Promise<SequenceData> {
    try {
      const sequence = await this.sequenceService.getSequence(sequenceId);
      if (!sequence) {
        throw new Error(`Sequence ${sequenceId} not found`);
      }

      const updatedSequence = updateSequenceData(sequence, {
        startPosition: startPosition,
        startingPositionBeat: startPosition, // CRITICAL: Set both fields for compatibility
      });

      await this.persistenceService.saveSequence(updatedSequence);
      return updatedSequence;
    } catch (error) {
      console.error("Failed to set construction start position:", error);
      throw new Error(
        `Failed to set start position: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // ============================================================================
  // SEQUENCE OPERATIONS
  // ============================================================================

  /**
   * Validate beat operations
   */
  canEditBeat(beatIndex: number, sequence: SequenceData | null): boolean {
    if (!sequence || beatIndex < 0 || beatIndex >= sequence.beats.length) {
      return false;
    }
    return true;
  }
}
