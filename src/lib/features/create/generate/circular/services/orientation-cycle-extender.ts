/**
 * SequenceData adapter for the sequence engine's orientation-cycle closure.
 */

import { closeOrientationCycle } from "@tka/sequence-engine/loop";
import type {
  Orientation as EngineOrientation,
  SequenceStep,
} from "@tka/sequence-engine";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { updateSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

export class OrientationCycleExtender {
  /**
   * The start orientations the engine closes against. Shared by the
   * count-only read and the applying path so an "×2" the Extend drawer
   * promises can never differ from the ×2 it actually appends.
   */
  private resolveStartOrientations(sequence: SequenceData): {
    blue: EngineOrientation;
    red: EngineOrientation;
  } {
    const startPosition = sequence.startPosition ?? sequence.startingPosition;
    return {
      blue: (startPosition?.motions?.blue?.startOrientation ??
        sequence.steps[0]?.motions.blue?.startOrientation ??
        "in") as EngineOrientation,
      red: (startPosition?.motions?.red?.startOrientation ??
        sequence.steps[0]?.motions.red?.startOrientation ??
        "in") as EngineOrientation,
    };
  }

  /**
   * How many total repeats bring the props back to their start orientation.
   * 1 means the sequence already closes in-orientation. Non-mutating — the
   * Extend drawer uses this to decide whether to offer the option, and to
   * label it with the count, before anything is applied.
   */
  getCycleCount(sequence: SequenceData): 1 | 2 | 4 | 8 {
    if (!sequence.steps?.length) return 1;

    try {
      return closeOrientationCycle(
        sequence.steps as unknown as readonly SequenceStep[],
        { startOrientations: this.resolveStartOrientations(sequence) }
      ).orientationCycleCount;
    } catch {
      // The engine throws rather than mislabel a sequence whose orientation
      // never returns within eight repetitions. That is a legitimate answer
      // to "how many repeats close this?" — none do. This is a read used to
      // decide whether to OFFER the repeat, so it reports 1 (nothing to
      // offer) instead of propagating into the panel that merely opened.
      return 1;
    }
  }

  extendIfNeeded(sequence: SequenceData): SequenceData {
    // SequenceData's StepData adds app-only reversal fields to the engine
    // shape. The engine clones each source step, so those fields survive.
    const result = closeOrientationCycle(
      sequence.steps as unknown as readonly SequenceStep[],
      { startOrientations: this.resolveStartOrientations(sequence) }
    );

    if (result.orientationCycleCount === 1) {
      return updateSequenceData(sequence, { orientationCycleCount: 1 });
    }

    return updateSequenceData(sequence, {
      steps: result.steps as unknown as StepData[],
      word: sequence.word.repeat(result.orientationCycleCount),
      orientationCycleCount: result.orientationCycleCount,
    });
  }
}

export const orientationCycleExtender = new OrientationCycleExtender();
