import type { ISequenceComposer } from "../contracts/ISequenceComposer";
import type { IStepDeriver } from "../contracts/IStepDeriver";
import type { IContentHasher } from "../contracts/IContentHasher";
import type { SoloPropData } from "../../domain/models/SoloPropData";
import type { StepPairingData } from "../../domain/models/StepPairingData";
import { createSequenceData, type SequenceData } from "../../domain/models/SequenceData";

export class SequenceComposer implements ISequenceComposer {
  constructor(
    private readonly stepDeriver: IStepDeriver,
    private readonly hasher: IContentHasher
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

    // Build per-beat pairing metadata. Letter resolution and reversal
    // detection are handled by dedicated services wired in separately, so
    // we set those fields to their deferred-computation defaults here.
    const pairings: StepPairingData[] = blue.steps.map(() => ({
      letter: null,
      blueReversal: false,
      redReversal: false,
      startPosition: null,
      endPosition: null,
    }));

    // Rehydrate StepData[] for backward compatibility with consumers that
    // still work against the flat step model rather than the compositional one.
    const derivedSteps = this.stepDeriver.deriveSteps(blue, red, pairings);

    // All letters are null until a letter-resolution pass runs, so the
    // TKA word is empty at this stage.
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
