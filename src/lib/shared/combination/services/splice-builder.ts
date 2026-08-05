/**
 * Walk -> SequenceData.
 *
 * STUB — Task 7 replaces this with the real post-processing pass: rebuild the
 * start position from the walk's first seam, re-derive the whole orientation
 * chain (`recalculateAllOrientations`) so a spliced block inherits the
 * orientations of whatever now precedes it, re-derive letters for twin blocks,
 * and recompute reversal flags.
 *
 * What it does today is the honest minimum the search core needs: concatenate
 * the blocks' steps in walk order and renumber them. Positions are carried
 * through untouched, which is what makes the closure/continuity assertions in
 * `sequence-combinator.test.ts` meaningful even at this stage — the search
 * guarantees seam continuity, and nothing here perturbs it.
 */

import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import {
  createSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { deriveWordFromBeats } from "$lib/shared/foundation/services/word-deriver";

import type { WalkBlock } from "../domain/types";

/**
 * Assemble a closed walk's blocks into a SequenceData.
 *
 * `frameCard` is the card the combination is expressed in — card A. Only its
 * grid mode is consumed here; Task 7 also takes its start-position framing.
 *
 * Step ids are derived, never random: two identical walks must produce
 * identical sequences, or the search's determinism guarantee stops at this
 * boundary.
 */
export async function buildResult(
  blocks: readonly WalkBlock[],
  frameCard: SequenceData
): Promise<SequenceData> {
  const steps: StepData[] = [];
  for (const block of blocks) {
    for (const step of block.steps) {
      const stepNumber = steps.length + 1;
      steps.push(
        createStepData({
          ...step,
          id: `${block.sourceId}:${step.id}@${stepNumber}`,
          stepNumber,
        })
      );
    }
  }

  const word = deriveWordFromBeats(steps);
  return createSequenceData({
    id: `combination:${blocks.map((b) => `${b.sourceId}#${b.startStepIndex}+${b.steps.length}`).join("|")}`,
    name: word || "combination",
    word,
    steps,
    isCircular: true,
    ...(frameCard.gridMode !== undefined && { gridMode: frameCard.gridMode }),
  });
}
