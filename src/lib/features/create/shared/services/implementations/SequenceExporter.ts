import type {
  ISequenceExporter,
  ExportableSequenceData,
  CondensedSequenceData,
  CondensedStartPosition,
  CondensedBeatData,
  CondensedMotionData,
  CondensedStartMotion,
} from "../contracts/ISequenceExporter";
import type { BeatData } from "../../domain/models/BeatData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";

/**
 * Service for exporting sequence data in various formats
 * Pure business logic - no Svelte dependencies
 */
export class SequenceExporter implements ISequenceExporter {
  /**
   * Create a condensed, human-readable version of sequence data
   * Removes: IDs, placement data, metadata, redundant fields
   * Keeps: Essential motion data for reconstruction
   */
  createCondensedSequence(
    sequenceData: ExportableSequenceData
  ): CondensedSequenceData {
    const condensed: CondensedSequenceData = {
      word: sequenceData.word,
      beats: [],
    };

    // Include start position FIRST if it exists
    if (sequenceData.startingPositionBeat ?? sequenceData.startPosition) {
      const startPos =
        sequenceData.startingPositionBeat ?? sequenceData.startPosition;
      if (startPos) {
        condensed.startPosition = this.extractStartPosition(startPos);
      }
    }

    // Process each beat AFTER start position
    if (sequenceData.beats) {
      condensed.beats = sequenceData.beats.map((beat) =>
        this.extractBeatData(beat)
      );
    }

    return condensed;
  }

  /**
   * Extract condensed start position data
   */
  private extractStartPosition(startPos: BeatData): CondensedStartPosition {
    const letter = startPos.letter ?? "";
    const gridPosition = startPos.startPosition ?? undefined;
    const blueMotion = startPos.motions.blue;
    const redMotion = startPos.motions.red;

    return {
      letter,
      gridPosition,
      motions: {
        blue: this.extractStartMotion(blueMotion),
        red: this.extractStartMotion(redMotion),
      },
    };
  }

  /**
   * Extract condensed start motion data (location and orientation only)
   */
  private extractStartMotion(
    motion: MotionData | undefined
  ): CondensedStartMotion {
    if (!motion) {
      return {
        startLocation: "",
        startOrientation: "",
      };
    }

    return {
      startLocation: motion.startLocation,
      startOrientation: motion.startOrientation,
    };
  }

  /**
   * Extract condensed beat data
   */
  private extractBeatData(beat: BeatData): CondensedBeatData {
    const letter = beat.letter ?? "";
    const gridPosition = beat.startPosition ?? undefined;
    const blueMotion = beat.motions.blue;
    const redMotion = beat.motions.red;

    return {
      letter,
      beatNumber: beat.beatNumber,
      gridPosition,
      duration: beat.duration,
      blueReversal: beat.blueReversal,
      redReversal: beat.redReversal,
      motions: {
        blue: this.extractMotionData(blueMotion),
        red: this.extractMotionData(redMotion),
      },
    };
  }

  /**
   * Extract condensed motion data (essential fields only)
   */
  private extractMotionData(
    motion: MotionData | undefined
  ): CondensedMotionData {
    if (!motion) {
      return {
        motionType: "",
        rotationDirection: "",
        startLocation: "",
        endLocation: "",
        turns: 0,
        startOrientation: "",
        endOrientation: "",
      };
    }

    return {
      motionType: motion.motionType,
      rotationDirection: motion.rotationDirection,
      startLocation: motion.startLocation,
      endLocation: motion.endLocation,
      turns: typeof motion.turns === "string" ? 0 : motion.turns,
      startOrientation: motion.startOrientation,
      endOrientation: motion.endOrientation,
    };
  }
}
