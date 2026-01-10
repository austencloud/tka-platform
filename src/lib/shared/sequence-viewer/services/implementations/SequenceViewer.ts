/**
 * Sequence Viewer Service Implementation
 *
 * Provides operations for loading, viewing, and editing sequences
 * in the standalone Sequence Viewer context.
 */

import type { SequenceData } from "../../../foundation/domain/models/SequenceData";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { ISequenceViewer } from "../contracts/ISequenceViewer";
import type { IPersistenceService } from "../../../persistence/services/contracts/IPersistenceService";
import type { ISequenceEncoder } from "../../../navigation/services/contracts/ISequenceEncoder";
import {
  updateSequenceData,
  removeBeatFromSequence,
} from "../../../foundation/domain/models/SequenceData";

export class SequenceViewer implements ISequenceViewer {
  constructor(
    private persistenceService: IPersistenceService,
    private SequenceEncoder: ISequenceEncoder
  ) {}

  // ============================================
  // SEQUENCE LOADING
  // ============================================

  async loadSequence(sequenceId: string): Promise<SequenceData | null> {
    try {
      return await this.persistenceService.loadSequence(sequenceId);
    } catch (error) {
      console.error(
        `[SequenceViewer] Failed to load sequence ${sequenceId}:`,
        error
      );
      return null;
    }
  }

  decodeSequence(encodedSequence: string): SequenceData | null {
    try {
      return this.SequenceEncoder.decodeWithCompression(encodedSequence);
    } catch (error) {
      console.error("[SequenceViewer] Failed to decode sequence:", error);
      return null;
    }
  }

  // ============================================
  // SEQUENCE MUTATIONS
  // ============================================

  updateBeatOrientation(
    sequence: SequenceData,
    beatIndex: number,
    color: string,
    orientation: string
  ): SequenceData {
    if (beatIndex === 0) {
      // Update start position
      const startPosition = this.getStartPosition(sequence);
      if (!startPosition) return sequence;

      const updatedStartPosition = this.updateMotionOrientation(
        startPosition,
        color,
        orientation
      );
      return updateSequenceData(sequence, {
        startPosition: updatedStartPosition as StartPositionData,
        startingPositionBeat: updatedStartPosition as StartPositionData,
      });
    }

    // Update regular beat (1-indexed in UI, 0-indexed in array)
    const arrayIndex = beatIndex - 1;
    if (arrayIndex < 0 || arrayIndex >= sequence.beats.length) {
      return sequence;
    }

    const beat = sequence.beats[arrayIndex];
    if (!beat) return sequence;

    const updatedBeat = this.updateMotionOrientation(beat, color, orientation);
    const newBeats = [...sequence.beats];
    newBeats[arrayIndex] = updatedBeat;

    return updateSequenceData(sequence, { beats: newBeats });
  }

  updateBeatTurns(
    sequence: SequenceData,
    beatIndex: number,
    color: string,
    turnAmount: number | "fl"
  ): SequenceData {
    if (beatIndex === 0) {
      // Start position doesn't typically have turns, but handle anyway
      const startPosition = this.getStartPosition(sequence);
      if (!startPosition) return sequence;

      const updatedStartPosition = this.updateMotionTurns(
        startPosition,
        color,
        turnAmount
      );
      return updateSequenceData(sequence, {
        startPosition: updatedStartPosition as StartPositionData,
        startingPositionBeat: updatedStartPosition as StartPositionData,
      });
    }

    // Update regular beat
    const arrayIndex = beatIndex - 1;
    if (arrayIndex < 0 || arrayIndex >= sequence.beats.length) {
      return sequence;
    }

    const beat = sequence.beats[arrayIndex];
    if (!beat) return sequence;

    const updatedBeat = this.updateMotionTurns(beat, color, turnAmount);
    const newBeats = [...sequence.beats];
    newBeats[arrayIndex] = updatedBeat;

    return updateSequenceData(sequence, { beats: newBeats });
  }

  removeBeat(sequence: SequenceData, beatIndex: number): SequenceData {
    // beatIndex is 0-indexed here (matches array index)
    return removeBeatFromSequence(sequence, beatIndex);
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  async saveSequence(sequence: SequenceData): Promise<void> {
    try {
      await this.persistenceService.saveSequence(sequence);
    } catch (error) {
      console.error("[SequenceViewer] Failed to save sequence:", error);
      throw error;
    }
  }

  // ============================================
  // THUMBNAILS & URLS
  // ============================================

  getThumbnailUrl(sequence: SequenceData, variationIndex = 0): string {
    if (!sequence.thumbnails || sequence.thumbnails.length === 0) {
      return "";
    }

    const index = Math.min(variationIndex, sequence.thumbnails.length - 1);
    return sequence.thumbnails[index] ?? "";
  }

  encodeForUrl(sequence: SequenceData): string {
    const result = this.SequenceEncoder.encodeWithCompression(sequence);
    return result.encoded;
  }

  generateShareUrl(sequence: SequenceData): string {
    const result = this.SequenceEncoder.generateViewerURL(sequence, {
      compress: true,
    });
    return result.url;
  }

  // ============================================
  // BEAT DATA HELPERS
  // ============================================

  getBeatData(sequence: SequenceData, beatIndex: number): BeatData | null {
    if (beatIndex === 0) {
      // Return start position as BeatData
      const startPos = this.getStartPosition(sequence);
      if (!startPos) return null;

      return {
        ...startPos,
        beatNumber: 0,
        duration: 1000,
        blueReversal: false,
        redReversal: false,
        isBlank: false,
      } as BeatData;
    }

    // Regular beat (1-indexed in UI, 0-indexed in array)
    const arrayIndex = beatIndex - 1;
    if (arrayIndex < 0 || arrayIndex >= sequence.beats.length) {
      return null;
    }

    return sequence.beats[arrayIndex] as BeatData;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private getStartPosition(
    sequence: SequenceData
  ): StartPositionData | BeatData | null {
    return (
      (sequence.startPosition as StartPositionData | BeatData) ||
      (sequence.startingPositionBeat as StartPositionData | BeatData) ||
      null
    );
  }

  private updateMotionOrientation<
    T extends { motions?: Record<string, unknown> },
  >(data: T, color: string, orientation: string): T {
    if (!data.motions) return data;

    const motionKey = color === "blue" ? "blueMotion" : "redMotion";
    const motion = data.motions[motionKey];

    if (!motion) return data;

    return {
      ...data,
      motions: {
        ...data.motions,
        [motionKey]: {
          ...motion,
          startOrientation: orientation,
        },
      },
    };
  }

  private updateMotionTurns<T extends { motions?: Record<string, unknown> }>(
    data: T,
    color: string,
    turnAmount: number | "fl"
  ): T {
    if (!data.motions) return data;

    const motionKey = color === "blue" ? "blueMotion" : "redMotion";
    const motion = data.motions[motionKey];

    if (!motion) return data;

    return {
      ...data,
      motions: {
        ...data.motions,
        [motionKey]: {
          ...motion,
          turns: turnAmount,
        },
      },
    };
  }
}
