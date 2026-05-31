import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";

export interface MinimalMotion {
  type: string;
  dir: string;
  startLoc: string;
  endLoc: string;
  turns: number;
  startOri: string;
  endOri: string;
}

export interface MinimalStep {
  step: number;
  letter: string;
  startPos: string;
  endPos: string;
  blue: MinimalMotion | null;
  red: MinimalMotion | null;
}

export interface SequenceKey {
  startPos: string;
  endPos: string;
  startLoc: string;
  endLoc: string;
  startOri: string;
  endOri: string;
  type: string;
  dir: string;
  turns: string;
}

export interface MinimalSequence {
  key: SequenceKey;
  name: string;
  word: string;
  isCircular: boolean;
  gridMode: string;
  startPosition: MinimalStep | null;
  steps: (MinimalStep | null)[];
}

/** Union type for beat-like objects that can be exported */
type StepLike = StepData | StartPositionData | null | undefined;

/**
 * Exports sequences to minimal JSON format for debugging/admin use.
 * Strips placement data fluff, keeps only essential motion data.
 */

function minimalMotion(motion: MotionData | null | undefined): MinimalMotion | null {
  if (!motion) return null;
  return {
    type: motion.motionType || "",
    dir: motion.rotationDirection || "",
    startLoc: motion.startLocation || "",
    endLoc: motion.endLocation || "",
    turns: typeof motion.turns === "number" ? motion.turns : 0,
    startOri: motion.startOrientation || "",
    endOri: motion.endOrientation || "",
  };
}

function minimalStep(beat: StepLike): MinimalStep | null {
  if (!beat) return null;
  // Handle both StepData (has stepNumber) and StartPositionData (no stepNumber)
  const stepNumber = "stepNumber" in beat ? beat.stepNumber : 0;
  return {
    step: stepNumber ?? 0,
    letter: beat.letter || "",
    startPos: beat.startPosition || "",
    endPos: beat.endPosition || "",
    blue: minimalMotion(beat.motions?.blue),
    red: minimalMotion(beat.motions?.red),
  };
}

export function toMinimalJson(sequence: SequenceData): MinimalSequence {
  return {
    key: {
      startPos: "position = combination of both hand locations (e.g. gamma1, alpha3)",
      endPos: "position at end of step",
      startLoc: "single hand grid location (n/e/s/w)",
      endLoc: "hand grid location at end of motion",
      startOri: "prop orientation at start (in/out/cw/ccw)",
      endOri: "prop orientation at end",
      type: "motion type (pro/anti/static/dash/float)",
      dir: "rotation direction (cw/ccw/noRotation)",
      turns: "additional rotation (0, 1, 2, fl)",
    },
    name: sequence.name || "",
    word: sequence.word || "",
    isCircular: sequence.isCircular || false,
    gridMode: sequence.gridMode || "",
    startPosition: minimalStep(
      sequence.startPosition || sequence.startingPosition
    ),
    steps: (sequence.steps || []).map((step) => minimalStep(step)),
  };
}

export function toJsonString(sequence: SequenceData): string {
  const minimal = toMinimalJson(sequence);
  return JSON.stringify(minimal, null, 2);
}

export async function copyToClipboard(sequence: SequenceData): Promise<boolean> {
  try {
    const jsonString = toJsonString(sequence);
    await navigator.clipboard.writeText(jsonString);
    return true;
  } catch (error) {
    console.error("Failed to copy sequence JSON:", error);
    return false;
  }
}
