/**
 * Layer 1 — the seam-graph closed-walk search.
 *
 * A **seam** is the total position between two steps (`GridPosition`, e.g.
 * "beta5"). Every card is a cyclic list of steps, and every step is an edge
 * from one seam to another. A COMBINATION of two cards is a closed walk in the
 * union of those edge sets that uses at least one step from each card — nothing
 * more exotic than that, which is why concatenation ("play all of A, then all
 * of B") and interleaving ("one step of A, one of B, ...") fall out of the same
 * search rather than needing separate code paths.
 *
 * The material the walk may use:
 *   - card A as given (the FRAME — never rotated, mirrored or colour-swapped,
 *     because the result is expressed in card A's orientation);
 *   - card A's rotation-faithful twin (`buildTwinSource`);
 *   - every distinct variant of card B (`buildVariants` — rotation, mirror,
 *     colour swap, twin, deduped cyclically).
 *
 * Ambient base-vocabulary material (ΦΨ bridges and friends) is Task 9. Until
 * then `allowAmbient` is accepted and ignored, and `impossible` means "no
 * combination exists from the two cards' own material" — the strong,
 * bridge-inclusive claim arrives with the ambient arm.
 *
 * **Iterative deepening, not plain DFS.** The walk space is exponential in
 * length (≈6 sources × up to 64 steps), so a depth-first sweep would spend its
 * whole budget on one very long branch and report the shapes it happened to
 * reach. Deepening by total step count instead makes the emitted order
 * shortest-first — which is both the useful answer ("what is the SMALLEST way
 * these two cards combine?") and a stable one, and it matches the
 * shortest-first contract Layer 0's `enumerateHybridWords` already settled on.
 *
 * Honest bounds: `searchComplete` is false when either the node budget or the
 * raw-walk cap stopped the sweep early. `impossible` is only ever true
 * alongside `searchComplete` — a search that ran out of budget proves nothing.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";

import {
  COMBINATOR_DEFAULTS,
  type CombinationSearchReport,
  type CombinatorOptions,
  type CombinatorTunables,
  type SeamState,
  type WalkBlock,
  type WalkSource,
} from "../domain/types";
import { seamEndOf, seamOf } from "./position-groups";
import { buildTwinSource, buildVariants } from "./variant-generator";
import { classifyAndRank, type RawWalk } from "./walk-classifier";

/** `CombinatorOptions.maxResultLength` is clamped to this. */
const HARD_MAX_RESULT_LENGTH = 64;

/**
 * Raw walks collected before the classifier runs, as a multiple of
 * `maxResults`. The classifier prunes further (content dedup, ranking), so the
 * search has to hand it more than the caller asked for — but not without limit.
 */
const RAW_WALK_OVERSHOOT = 8;

/** A step of some source that a walk can enter at. */
interface SeamEntry {
  readonly sourceIndex: number;
  readonly stepIndex: number;
}

/** The one place a `WalkSource`'s step list is read (ambient sources have none). */
function stepsOf(source: WalkSource): readonly StepData[] {
  return source.kind === "ambient" ? [] : source.sequence.steps;
}

function isRotationFaithful(source: WalkSource): boolean {
  return source.kind === "ambient" ? false : source.variant.rotationFaithful;
}

function commitBlock(
  source: WalkSource,
  startStepIndex: number,
  steps: readonly StepData[]
): WalkBlock {
  return {
    sourceId: source.id,
    kind: source.kind,
    startStepIndex,
    steps: [...steps],
    rotationFaithful: isRotationFaithful(source),
  };
}

/**
 * One key per step: `sourceId#indexWithinSource`, then the lexicographically
 * smallest ROTATION of that list.
 *
 * The rotation is the whole point. A closed walk has no start — the same cyclic
 * combination is reachable from every card-A step it passes through, and a
 * 4-fold symmetric card therefore finds it four times, each with a different
 * block split (entering mid-block splits one block into two). Keying on the
 * per-STEP list rather than on the blocks makes those phases identical strings,
 * which is what collapses them to one result.
 */
function canonicalWalkSignature(
  blocks: readonly WalkBlock[],
  lengthOfSource: ReadonlyMap<string, number>
): string {
  const keys: string[] = [];
  for (const block of blocks) {
    const length = lengthOfSource.get(block.sourceId) ?? 0;
    for (let i = 0; i < block.steps.length; i++) {
      const index =
        length > 0
          ? (block.startStepIndex + i) % length
          : block.startStepIndex + i;
      keys.push(`${block.sourceId}#${index}`);
    }
  }

  let best = keys.join(">");
  for (let k = 1; k < keys.length; k++) {
    const rotated = [...keys.slice(k), ...keys.slice(0, k)].join(">");
    if (rotated < best) best = rotated;
  }
  return best;
}

/**
 * Every closed alternating walk over card A and card B, or a proof that none
 * exists within the searched material.
 */
export async function findCombinations(
  cardA: SequenceData,
  cardB: SequenceData,
  options: CombinatorOptions = {}
): Promise<CombinationSearchReport> {
  const opts: CombinatorTunables = {
    ...COMBINATOR_DEFAULTS,
    ...options,
    maxResultLength: Math.min(
      options.maxResultLength ?? COMBINATOR_DEFAULTS.maxResultLength,
      HARD_MAX_RESULT_LENGTH
    ),
  };

  // Odd rotations are the only transform that changes grid mode, and the
  // variant generator never emits one — so two cards in different modes share
  // no reachable seam at all. Say so instead of searching for it.
  if ((cardA.gridMode ?? "diamond") !== (cardB.gridMode ?? "diamond")) {
    return {
      results: [],
      impossible: true,
      searchComplete: true,
      gridModeMismatch: true,
    };
  }

  const frameSource: WalkSource = {
    kind: "cardA",
    id: "A",
    variant: {
      rotation: 0,
      mirrored: false,
      colorSwapped: false,
      rotationFaithful: false,
    },
    sequence: cardA,
  };

  const sources: WalkSource[] = [frameSource];
  if (opts.exploreRotationFaithful) {
    sources.push(await buildTwinSource(cardA));
  }
  sources.push(...(await buildVariants(cardB, opts)));

  const sourceSteps = sources.map(stepsOf);
  const lengthOfSource = new Map(
    sources.map((source, index) => [source.id, sourceSteps[index]!.length])
  );

  // Seam -> every (source, step) that STARTS there. Steps with no position
  // never enter the map, so a null seam can never be walked through.
  const entries = new Map<SeamState, SeamEntry[]>();
  sourceSteps.forEach((steps, sourceIndex) => {
    steps.forEach((step, stepIndex) => {
      const seam = seamOf(step);
      if (!seam) return;
      const list = entries.get(seam);
      if (list) list.push({ sourceIndex, stepIndex });
      else entries.set(seam, [{ sourceIndex, stepIndex }]);
    });
  });

  const rawWalks = new Map<string, RawWalk>();
  const rawWalkCap = Math.max(opts.maxResults * RAW_WALK_OVERSHOOT, 1);
  let budget = opts.searchBudget;
  let searchComplete = true;
  let stopped = false;

  const record = (blocks: WalkBlock[], totalSteps: number): void => {
    const signature = canonicalWalkSignature(blocks, lengthOfSource);
    const existing = rawWalks.get(signature);
    if (existing) {
      // Same cyclic walk entered at a different phase. Prefer the
      // representative with the fewest blocks — that is the one whose block
      // boundaries are real seam changes rather than an artefact of where the
      // search happened to enter the loop.
      if (blocks.length < existing.blocks.length) {
        rawWalks.set(signature, { blocks, totalSteps, signature });
      }
      return;
    }

    rawWalks.set(signature, { blocks, totalSteps, signature });
    if (rawWalks.size >= rawWalkCap) {
      stopped = true;
      searchComplete = false;
    }
  };

  /**
   * @param startSeam   where the walk began; closure means returning here
   * @param currentSeam where the walk stands now
   * @param sourceIndex the source the current (uncommitted) block belongs to
   * @param nextIndex   the next step of that source, cyclically
   * @param blockSteps  steps of the current block, not yet committed
   * @param blockStart  index the current block entered its source at
   * @param blocks      committed blocks
   * @param usedA/usedB whether card A / card B material is in the walk,
   *                    INCLUDING the uncommitted block
   */
  const visit = (
    limit: number,
    startSeam: SeamState,
    currentSeam: SeamState,
    sourceIndex: number,
    nextIndex: number,
    blockSteps: StepData[],
    blockStart: number,
    blocks: WalkBlock[],
    totalSteps: number,
    usedA: boolean,
    usedB: boolean
  ): void => {
    if (stopped) return;
    if (budget <= 0) {
      searchComplete = false;
      stopped = true;
      return;
    }
    budget--;

    const source = sources[sourceIndex]!;
    const steps = sourceSteps[sourceIndex]!;

    if (
      currentSeam === startSeam &&
      totalSteps >= 2 &&
      // A walk that never left its source is that card played on its own, not
      // a combination — at least one committed block plus the current one.
      blocks.length >= 1 &&
      blockSteps.length >= opts.minBlockSize &&
      usedA &&
      usedB
    ) {
      record(
        [...blocks, commitBlock(source, blockStart, blockSteps)],
        totalSteps
      );
      if (stopped) return;
    }

    if (totalSteps >= limit || steps.length === 0) return;

    // Extend: stay in this source and take its next step.
    const nextStep = steps[nextIndex % steps.length]!;
    const nextEnd = seamEndOf(nextStep);
    if (nextEnd && seamOf(nextStep) === currentSeam) {
      visit(
        limit,
        startSeam,
        nextEnd,
        sourceIndex,
        nextIndex + 1,
        [...blockSteps, nextStep],
        blockStart,
        blocks,
        totalSteps + 1,
        usedA || source.kind === "cardA",
        usedB || source.kind === "cardB"
      );
      if (stopped) return;
    }

    // Jump: hand off to a DIFFERENT source at this seam. Staying inside the
    // same source is the extend branch above; re-entering it at another phase
    // would splice a card into itself, which is not a combination of two cards.
    if (blockSteps.length < opts.minBlockSize) return;

    const committed = commitBlock(source, blockStart, blockSteps);
    for (const entry of entries.get(currentSeam) ?? []) {
      if (entry.sourceIndex === sourceIndex) continue;
      const target = sources[entry.sourceIndex]!;
      const step = sourceSteps[entry.sourceIndex]![entry.stepIndex]!;
      const end = seamEndOf(step);
      if (!end) continue;

      visit(
        limit,
        startSeam,
        end,
        entry.sourceIndex,
        entry.stepIndex + 1,
        [step],
        entry.stepIndex,
        [...blocks, committed],
        totalSteps + 1,
        usedA || target.kind === "cardA",
        usedB || target.kind === "cardB"
      );
      if (stopped) return;
    }
  };

  const frameSteps = sourceSteps[0]!;
  // Deepen by total step count: the shortest combinations first.
  for (let limit = 2; limit <= opts.maxResultLength && !stopped; limit++) {
    for (let start = 0; start < frameSteps.length && !stopped; start++) {
      const step = frameSteps[start]!;
      const seam = seamOf(step);
      const end = seamEndOf(step);
      if (!seam || !end) continue;
      visit(limit, seam, end, 0, start + 1, [step], start, [], 1, true, false);
    }
  }

  const results = await classifyAndRank(
    [...rawWalks.values()],
    cardA,
    cardB,
    sources,
    opts
  );

  return {
    results,
    impossible: results.length === 0 && searchComplete,
    searchComplete,
    gridModeMismatch: false,
  };
}
