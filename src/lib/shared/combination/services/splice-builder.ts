/**
 * Walk -> SequenceData: the pass that turns a graph object into something a
 * human can actually pick up two props and perform.
 *
 * The search guarantees POSITIONAL continuity — every block starts where the
 * previous one ended, and the walk returns to its own start seam. It guarantees
 * nothing about ORIENTATION, and it cannot: a block's entry orientation depends
 * on whatever now precedes it, which in a spliced walk is not what preceded it
 * on its own card. Card A's 4th step may have handed its H-block an `out` where
 * the H card's own cycle handed it an `in`.
 *
 * So the whole chain is re-derived here, from a single seed:
 *
 *   1. Flatten the blocks in walk order, renumbering 1..n.
 *   2. Rebuild the START POSITION — a static both-hands hold at the first step's
 *      start. That hold IS the frame: its orientations are the walk's only
 *      orientation input.
 *   3. `recalculateAllOrientations` — propagate from the hold through every
 *      step. THIS is the step that makes a mixed-source walk performable, and
 *      the reason a splice is more than a concatenation.
 *   4. `deriveSequenceLetters` — normalization, not correction. Dataframe rows
 *      carry no orientation (see `fixtures.test.ts` rowKey), so step 3 cannot
 *      change a letter; running the lookup anyway catches material that was
 *      never a real row in the first place, and says so out loud.
 *   5. `processReversals` — reversal dots over the NEW step order. Splice seams
 *      are exactly where a prop-direction flip appears, which is what Austen's
 *      letter-faithful GG+HH examples show.
 *
 * **Orientation closure is NOT forced.** A closed walk closes positionally by
 * construction; whether it also returns to its start ORIENTATION is a property
 * of the material. When it does not, the loop simply has a period > 1 — two (or
 * four) passes to return to identity — which is ordinary TKA, not an error. The
 * `period` field is left unset here rather than guessed; classification is Task
 * 8's.
 *
 * **Arrow locations are not recomputed.** A step's arrow locations are a
 * function of its own two motions' locations plus its letter, and splicing
 * changes neither — only orientations, which arrow placement does not read. The
 * variant generator already normalized them when it built the material.
 *
 * Everything here is DETERMINISTIC: ids are derived from block index, step
 * index and the source step's own id, never minted. Two identical walks must
 * produce byte-identical sequences, or the search's determinism guarantee stops
 * at this boundary. (That is also why the start position is assembled here
 * rather than via `createStartPositionFromBeatStart`, whose id is
 * `start-derived-${Date.now()}`.)
 */

import { recalculateAllOrientations } from "$lib/shared/create/services/orientation-propagation";
import { reversalDetector } from "$lib/shared/create/services/reversal-detector";
import { deriveSequenceLetters } from "$lib/shared/create/services/sequence-transformer";
import { createStartPositionData } from "$lib/shared/foundation/domain/factories/create-start-position-data";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import {
  createSequenceData,
  updateSequenceData,
  type SequenceData,
} from "$lib/shared/foundation/domain/models/sequence-data";
import type { StartPositionData } from "$lib/shared/foundation/domain/models/start-position-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { deriveWord } from "$lib/shared/foundation/services/word-deriver";
import {
  MotionColor,
  MotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import {
  createMotionData,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/motion-data";

import type { WalkBlock } from "../domain/types";

/**
 * One hand's motion, frozen where it stands: same location, same orientation,
 * nothing rotating. The same construction the fixtures' `holdOf` uses.
 */
function holdOf(motion: MotionData): MotionData {
  return createMotionData({
    ...motion,
    motionType: MotionType.STATIC,
    rotationDirection: RotationDirection.NO_ROTATION,
    endLocation: motion.startLocation,
    endOrientation: motion.startOrientation,
    arrowLocation: motion.startLocation,
    turns: 0,
  });
}

/**
 * The static both-hands hold the spliced sequence begins from.
 *
 * The ORIENTATION SEED. `recalculateAllOrientations` reads this hold's end
 * orientations and nothing else, so seeding it from the walk's first step means
 * the result is expressed in the frame that step was written in — and every
 * downstream orientation follows from there.
 *
 * `letter` stays null: the α/β/Γ static-letter helper is module-private to
 * `create/services/sequence-transforms`, and the fixtures' own loops carry null
 * here too, so this matches the corpus rather than inventing a third shape.
 */
function buildStartHold(first: StepData, id: string): StartPositionData {
  return createStartPositionData({
    id,
    letter: null,
    startPosition: first.startPosition ?? null,
    endPosition: first.startPosition ?? null,
    gridPosition: first.startPosition ?? null,
    motions: {
      [MotionColor.BLUE]: holdOf(first.motions.blue),
      [MotionColor.RED]: holdOf(first.motions.red),
    },
  });
}

/**
 * Re-derive every step's letter from its own motions.
 *
 * Mirrors `variant-generator`'s `withDerivedLetters`: `deriveSequenceLetters`
 * KEEPS the existing letter when a lookup fails, so a surviving null means the
 * spliced material is not a dataframe row — worth saying out loud rather than
 * carrying silently into a word.
 */
async function withDerivedLetters(seq: SequenceData): Promise<SequenceData> {
  let derived: SequenceData;
  try {
    derived = await deriveSequenceLetters(seq);
  } catch (error) {
    // The dataframe is unavailable (no CSV, no IndexedDB). Letters are
    // orientation-independent, so the carried-through ones are still correct —
    // degrade to them rather than losing the whole splice.
    console.warn(
      "[splice-builder] letter derivation unavailable; keeping carried letters",
      error
    );
    return seq;
  }

  const unresolved = derived.steps.filter((step) => step.letter === null);
  if (unresolved.length > 0) {
    console.warn(
      `[splice-builder] ${unresolved.length} of ${derived.steps.length} spliced steps have no dataframe letter ` +
        `(steps ${unresolved.map((s) => s.stepNumber).join(", ")}); the result will carry them unlettered.`
    );
  }
  return derived;
}

/**
 * Assemble a closed walk's blocks into a performable SequenceData.
 *
 * `frameCard` is the card the combination is expressed in — card A. Its grid
 * mode is carried onto the result; its start position is NOT, because a walk
 * may enter card A at any step and the hold has to match the step the walk
 * actually begins on.
 */
export async function buildResult(
  blocks: readonly WalkBlock[],
  frameCard: SequenceData
): Promise<SequenceData> {
  const steps: StepData[] = [];
  blocks.forEach((block, blockIndex) => {
    block.steps.forEach((step, stepIndex) => {
      const stepNumber = steps.length + 1;
      steps.push(
        createStepData({
          ...step,
          // Block index + step index + the source step's own id. Derived, never
          // minted: `crypto.randomUUID()` here would make two runs of the same
          // search produce different sequences.
          id: `${blockIndex}.${stepIndex}:${block.sourceId}:${step.id}`,
          stepNumber,
          // Reversal flags describe adjacency in the SOURCE ordering; the
          // splice has a new one. Cleared here, recomputed below.
          blueReversal: false,
          redReversal: false,
        })
      );
    });
  });

  const id = `combination:${blocks
    .map((b) => `${b.sourceId}#${b.startStepIndex}+${b.steps.length}`)
    .join("|")}`;

  const first = steps[0];
  const spliced = createSequenceData({
    id,
    steps,
    isCircular: true,
    ...(frameCard.gridMode !== undefined && { gridMode: frameCard.gridMode }),
    ...(first && { startPosition: buildStartHold(first, `${id}-start`) }),
  });

  // 3 → 4 → 5. Order matters only between 3 and 5: reversal flags are read off
  // the final step order, and nothing after 3 reorders anything.
  const oriented = recalculateAllOrientations(spliced);
  const lettered = await withDerivedLetters(oriented);
  const withReversals = reversalDetector.processReversals(lettered);

  const word = deriveWord(withReversals);
  return updateSequenceData(withReversals, {
    word,
    // Display simplification (FΨFΨ -> FΨ) is word-simplifier's job at the
    // display layer; `word` and `name` are the data layer's full expansion.
    name: word || "combination",
  });
}
