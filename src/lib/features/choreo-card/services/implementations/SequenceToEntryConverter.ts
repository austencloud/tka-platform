/**
 * Converts SequenceData (library format with StepData[]) to SequenceEntry (LOOP detector format)
 *
 * The LOOP detector needs raw string-based data in a specific format.
 * This converter extracts the necessary data from the typed SequenceData model.
 */
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { SequenceEntry, RawStepData, RawMotionAttributes } from "$lib/features/loop-labeler/domain/models/sequence-models";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export class SequenceToEntryConverter {
  convert(sequence: SequenceData): SequenceEntry {
    const rawSequence = this.convertStepsToRaw(sequence);

    return {
      id: sequence.id,
      word: sequence.word,
      isCircular: sequence.isCircular,
      loopType: sequence.loopType ?? null,
      thumbnails: [...sequence.thumbnails],
      sequenceLength: sequence.sequenceLength ?? sequence.steps.length,
      gridMode: sequence.gridMode ?? GridMode.DIAMOND,
      fullMetadata: {
        sequence: rawSequence,
      },
    };
  }

  private convertStepsToRaw(sequence: SequenceData): RawStepData[] {
    const result: RawStepData[] = [];

    // Add metadata object as beat 0 (the LOOP detector expects this)
    const startPos = sequence.startPosition ?? sequence.startingPosition;
    result.push({
      beat: 0,
      word: sequence.word,
      author: sequence.author,
      level: sequence.level,
      isCircular: sequence.isCircular,
      gridMode: sequence.gridMode ?? GridMode.DIAMOND,
      sequenceStartPosition: startPos?.endPosition ?? undefined,
      endPos: startPos?.endPosition ?? undefined,
    });

    // Convert each step to raw format
    for (const step of sequence.steps) {
      result.push(this.convertStepToRaw(step));
    }

    return result;
  }

  private convertStepToRaw(step: StepData): RawStepData {
    const blueMotion = step.motions[MotionColor.BLUE];
    const redMotion = step.motions[MotionColor.RED];

    return {
      beat: step.stepNumber,
      letter: step.letter ?? undefined,
      startPos: step.startPosition ?? undefined,
      endPos: step.endPosition ?? undefined,
      blueAttributes: blueMotion ? this.convertMotionToRaw(blueMotion) : undefined,
      redAttributes: redMotion ? this.convertMotionToRaw(redMotion) : undefined,
    };
  }

  private convertMotionToRaw(motion: MotionData): RawMotionAttributes {
    return {
      motionType: motion.motionType,
      startLoc: motion.startLocation,
      endLoc: motion.endLocation,
      startOri: motion.startOrientation,
      endOri: motion.endOrientation,
      propRotDir: motion.rotationDirection,
      turns: motion.turns,
    };
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const sequenceToEntryConverter = new SequenceToEntryConverter();
