import type { StepDeriver } from "./StepDeriver";
import type { ContentHasher } from "./ContentHasher";
import type { SoloPropData } from "../../domain/models/SoloPropData";
import type { StepPairingData } from "../../domain/models/StepPairingData";
import { createSequenceData, type SequenceData } from "../../domain/models/SequenceData";

export class SequenceComposer {
  constructor(
    private readonly stepDeriver: StepDeriver,
    private readonly hasher: ContentHasher
  ) {}

  combine(
    assignments: { blue: SoloPropData; red: SoloPropData },
    metadata?: { name?: string; author?: string; notes?: string }
  ): SequenceData {
    const { blue, red } = assignments;

    if (blue.steps.length !== red.steps.length) {
      throw new Error(
        `SequenceComposer: step count mismatch - ` +
          `blue=${blue.steps.length}, red=${red.steps.length}. ` +
          `Both solo props must have the same number of steps to be combined.`
      );
    }

    const pairings: StepPairingData[] = blue.steps.map(() => ({
      letter: null,
      blueReversal: false,
      redReversal: false,
      startPosition: null,
      endPosition: null,
    }));

    const derivedSteps = this.stepDeriver.deriveSteps(blue, red, pairings);

    const derivedWord = "";

    return createSequenceData({
      steps: derivedSteps,
      word: derivedWord,
      name: metadata?.name ?? "",
      author: metadata?.author,
      notes: metadata?.notes,
      blueSoloProp: blue,
      redSoloProp: red,
      stepPairings: pairings,
      bluePathHash: blue.handPath.contentHash,
      redPathHash: red.handPath.contentHash,
      blueSoloHash: blue.contentHash,
      redSoloHash: red.contentHash,
    });
  }
}
