import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { StepData } from "../../domain/models/StepData";
import type { StartPositionData } from "../../domain/models/StartPositionData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { MinimalSequence, MinimalStep, MinimalMotion } from "../contracts/types";

/** Union type for beat-like objects that can be exported */
type StepLike = StepData | StartPositionData | null | undefined;

/**
 * SequenceJsonExporter
 *
 * Exports sequences to minimal JSON format for debugging/admin use.
 * Strips placement data fluff, keeps only essential motion data.
 */
export class SequenceJsonExporter {
  toMinimalJson(sequence: SequenceData): MinimalSequence {
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
      startPosition: this.minimalStep(
        sequence.startPosition || sequence.startingPosition
      ),
      steps: (sequence.steps || []).map((step) => this.minimalStep(step)),
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
      startLoc: motion.startLocation || "",
      endLoc: motion.endLocation || "",
      turns: typeof motion.turns === "number" ? motion.turns : 0,
      startOri: motion.startOrientation || "",
      endOri: motion.endOrientation || "",
    };
  }

  private minimalStep(beat: StepLike): MinimalStep | null {
    if (!beat) return null;
    // Handle both StepData (has stepNumber) and StartPositionData (no stepNumber)
    const stepNumber = "stepNumber" in beat ? beat.stepNumber : 0;
    return {
      step: stepNumber ?? 0,
      letter: beat.letter || "",
      startPos: beat.startPosition || "",
      endPos: beat.endPosition || "",
      blue: this.minimalMotion(beat.motions?.blue),
      red: this.minimalMotion(beat.motions?.red),
    };
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const sequenceJsonExporter = new SequenceJsonExporter();
