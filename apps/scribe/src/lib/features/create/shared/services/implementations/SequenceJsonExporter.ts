import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "../../domain/models/StepData";
import type { StartPositionData } from "../../domain/models/StartPositionData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type {
  ISequenceJsonExporter,
  MinimalSequence,
  MinimalBeat,
  MinimalMotion,
} from "../contracts/ISequenceJsonExporter";

/** Union type for beat-like objects that can be exported */
type BeatLike = StepData | StartPositionData | null | undefined;

/**
 * SequenceJsonExporter
 *
 * Exports sequences to minimal JSON format for debugging/admin use.
 * Strips placement data fluff, keeps only essential motion data.
 */
export class SequenceJsonExporter implements ISequenceJsonExporter {
  toMinimalJson(sequence: SequenceData): MinimalSequence {
    return {
      name: sequence.name || "",
      word: sequence.word || "",
      isCircular: sequence.isCircular || false,
      gridMode: sequence.gridMode || "",
      // propType removed - prop type is a viewer preference, not sequence data
      startPosition: this.minimalBeat(
        sequence.startPosition || sequence.startingPosition
      ),
      steps: (sequence.steps || []).map((beat) => this.minimalBeat(beat)),
    };
  }

  toJsonString(sequence: SequenceData): string {
    const minimal = this.toMinimalJson(sequence);
    return JSON.stringify(minimal, null, 2);
  }

  async copyToClipboard(sequence: SequenceData): Promise<boolean> {
    try {
      const jsonString = this.toJsonString(sequence);
      await navigator.clipboard.writeText(jsonString);
      return true;
    } catch (error) {
      console.error("Failed to copy sequence JSON:", error);
      return false;
    }
  }

  private minimalMotion(motion: MotionData | null | undefined): MinimalMotion | null {
    if (!motion) return null;
    return {
      type: motion.motionType || "",
      dir: motion.rotationDirection || "",
      start: motion.startLocation || "",
      end: motion.endLocation || "",
      turns: typeof motion.turns === "number" ? motion.turns : 0,
      startOri: motion.startOrientation || "",
      endOri: motion.endOrientation || "",
    };
  }

  private minimalBeat(beat: BeatLike): MinimalBeat | null {
    if (!beat) return null;
    // Handle both StepData (has stepNumber) and StartPositionData (no stepNumber)
    const stepNumber = "stepNumber" in beat ? beat.stepNumber : 0;
    return {
      beat: stepNumber ?? 0,
      letter: beat.letter || "",
      start: beat.startPosition || "",
      end: beat.endPosition || "",
      blue: this.minimalMotion(beat.motions?.blue),
      red: this.minimalMotion(beat.motions?.red),
    };
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const sequenceJsonExporter = new SequenceJsonExporter();
