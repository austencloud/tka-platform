import type {
  ExportableSequenceData,
  CondensedSequenceData,
  CondensedStartPosition,
  CondensedStepData,
  CondensedMotionData,
  CondensedStartMotion,
} from "./contracts/types";
import type { StepData } from "../domain/models/StepData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";

/**
 * sequence-exporter.ts
 *
 * Functions for exporting sequence data in various formats.
 * Pure business logic - no Svelte dependencies.
 */

/**
 * Create a condensed, human-readable version of sequence data.
 * Removes: IDs, placement data, metadata, redundant fields.
 * Keeps: Essential motion data for reconstruction.
 */
export function createCondensedSequence(
  sequenceData: ExportableSequenceData
): CondensedSequenceData {
  const condensed: CondensedSequenceData = {
    word: sequenceData.word,
    steps: [],
  };

  // Include start position FIRST if it exists
  if (sequenceData.startingPosition ?? sequenceData.startPosition) {
    const startPos =
      sequenceData.startingPosition ?? sequenceData.startPosition;
    if (startPos) {
      condensed.startPosition = extractStartPosition(startPos);
    }
  }

  // Process each beat AFTER start position
  if (sequenceData.steps) {
    condensed.steps = sequenceData.steps.map((step) => extractStepData(step));
  }

  return condensed;
}

// ============================================================================
// MODULE-PRIVATE HELPERS
// ============================================================================

function extractStartPosition(startPos: StepData): CondensedStartPosition {
  const letter = startPos.letter ?? "";
  const gridPosition = startPos.startPosition ?? undefined;
  const blueMotion = startPos.motions.blue;
  const redMotion = startPos.motions.red;

  return {
    letter,
    gridPosition,
    motions: {
      blue: extractStartMotion(blueMotion),
      red: extractStartMotion(redMotion),
    },
  };
}

function extractStartMotion(
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

function extractStepData(beat: StepData): CondensedStepData {
  const letter = beat.letter ?? "";
  const gridPosition = beat.startPosition ?? undefined;
  const blueMotion = beat.motions.blue;
  const redMotion = beat.motions.red;

  return {
    letter,
    stepNumber: beat.stepNumber,
    gridPosition,
    duration: beat.duration,
    blueReversal: beat.blueReversal,
    redReversal: beat.redReversal,
    motions: {
      blue: extractMotionData(blueMotion),
      red: extractMotionData(redMotion),
    },
  };
}

function extractMotionData(motion: MotionData | undefined): CondensedMotionData {
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
