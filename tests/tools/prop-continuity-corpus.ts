/**
 * The sequences the prop-continuity sweep runs against.
 *
 * Two sets, both real:
 *
 * 1. The 19 core TnD motions. `scripts/seed-tnd-deck.ts` is the single
 *    canonical seeder for the `l1-tnd-motions` deck and its build path is pure
 *    (`DiamondPictographDataframe.csv` in, sequences out, no Firestore), so the
 *    corpus is built through it rather than transcribed. Its `TND_MOTIONS`
 *    table currently holds 22 entries: ids 1-19 are the original core set, and
 *    20-22 (PMPM/QNQN/RORO at gamma9) were added later by the gamma-split work
 *    and appear in no shipped card data. This corpus takes ids 1-19.
 *
 * 2. The seven fixtures the staff-grip lab pins, straight from
 *    `ALL_FIXTURE_LOOPS` - the same objects `lab-catalog.ts` turns into its
 *    picker options.
 */

import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { createStartPositionData } from "$lib/shared/foundation/domain/factories/create-start-position-data";
import { createStepData } from "$lib/shared/foundation/domain/factories/create-step-data";
import { createSequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { ALL_FIXTURE_LOOPS } from "$lib/shared/combination/domain/demo-fixtures";

import {
  loadCsv,
  buildTnDSequence,
  buildFirestoreStep,
  buildFirestoreStartPosition,
  TND_MOTIONS,
} from "../../scripts/seed-tnd-deck";

/** Ids 1-19 of the seeder's table: the core set, before the gamma-split trio. */
export const CORE_TND_IDS = Array.from({ length: 19 }, (_, i) => i + 1);

export interface CorpusEntry {
  readonly id: string;
  readonly word: string;
  readonly group: "core-tnd" | "lab-fixture";
  readonly sequence: SequenceData;
}

function toSequenceData(
  id: string,
  word: string,
  startPosition: ReturnType<typeof buildFirestoreStartPosition>,
  steps: ReturnType<typeof buildFirestoreStep>[]
): SequenceData {
  return createSequenceData({
    id,
    name: word,
    word,
    steps: steps.map((step) =>
      createStepData({
        ...step,
        motions: {
          left: createMotionData(step.motions.left as never),
          right: createMotionData(step.motions.right as never),
        },
      } as never)
    ),
    startPosition: createStartPositionData({
      ...startPosition,
      motions: {
        left: createMotionData(startPosition.motions.left as never),
        right: createMotionData(startPosition.motions.right as never),
      },
    } as never),
    isCircular: true,
    level: 1,
  } as never);
}

/** The 19 core TnD motions, built from the canonical dataframe. */
export function coreTnDCorpus(): CorpusEntry[] {
  const rows = loadCsv();
  return TND_MOTIONS.filter((def) => CORE_TND_IDS.includes(def.id)).map(
    (def) => {
      const built = buildTnDSequence(def, rows);
      const steps = built.beats.map((beat, index) =>
        buildFirestoreStep(beat, index + 1)
      );
      return {
        id: built.seqId,
        word: built.word,
        group: "core-tnd" as const,
        sequence: toSequenceData(
          built.seqId,
          built.word,
          buildFirestoreStartPosition(built),
          steps
        ),
      };
    }
  );
}

/** The seven fixtures the staff-grip lab pins. */
export function labFixtureCorpus(): CorpusEntry[] {
  return ALL_FIXTURE_LOOPS.map(([, sequence]) => ({
    id: sequence.id,
    word: sequence.word,
    group: "lab-fixture" as const,
    sequence,
  }));
}

export function propContinuityCorpus(): CorpusEntry[] {
  return [...coreTnDCorpus(), ...labFixtureCorpus()];
}
