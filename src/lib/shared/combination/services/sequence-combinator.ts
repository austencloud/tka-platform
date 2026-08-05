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
 * then, a walk is built from the two cards' own material only.
 *
 * **Two claims, kept apart.** The reachability precheck below decides
 * `impossible` — a structural, any-length proof that costs O(seams). The walk
 * search decides what EXISTS, and its failure to find something is reported as
 * `searchedToLength` ("nothing of this length or shorter"), never as
 * impossibility. A bounded search cannot prove a negative, and conflating the
 * two would let a budget timeout masquerade as a theorem.
 *
 * **Iterative deepening, not plain DFS.** The walk space is exponential in
 * length, so a depth-first sweep would spend its whole budget on one very deep
 * branch and report the shapes it happened to reach. Deepening by total step
 * count instead makes the emitted order shortest-first — both the useful answer
 * ("what is the SMALLEST way these two cards combine?") and a stable one, and
 * it matches the shortest-first contract Layer 0's `enumerateHybridWords`
 * already settled on.
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

/** `CombinatorOptions.maxResultLength` is clamped to this range. */
const MIN_RESULT_LENGTH = 2;
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
 * Merge a wrap-split block pair.
 *
 * A closed walk has no start, but the search has to enter it somewhere — and
 * entering in the MIDDLE of a run splits that one run into the walk's first and
 * last blocks. `A[0..2] B[..] A[3..3]` and `A[3..2] B[..]` are the same loop
 * with the same blocks; only the entry differs. Rejoining the pair before the
 * signature is taken means every phase of a walk produces the SAME partition,
 * so the block structure a caller reads is a property of the loop rather than
 * an artefact of where the search happened to start.
 *
 * Only the first/last pair can ever need this: a same-source jump landing where
 * the extend branch would have gone is excluded at the jump site, so no two
 * ADJACENT blocks are ever cyclically contiguous.
 */
function canonicalPartition(
  blocks: readonly WalkBlock[],
  lengthOfSource: ReadonlyMap<string, number>
): readonly WalkBlock[] {
  if (blocks.length < 2) return blocks;

  const first = blocks[0]!;
  const last = blocks[blocks.length - 1]!;
  if (first.sourceId !== last.sourceId) return blocks;

  const length = lengthOfSource.get(first.sourceId) ?? 0;
  if (length === 0) return blocks;
  if (
    (last.startStepIndex + last.steps.length) % length !==
    first.startStepIndex % length
  ) {
    return blocks;
  }

  const merged: WalkBlock = {
    sourceId: first.sourceId,
    kind: first.kind,
    startStepIndex: last.startStepIndex,
    steps: [...last.steps, ...first.steps],
    rotationFaithful: first.rotationFaithful,
  };
  return [merged, ...blocks.slice(1, -1)];
}

/**
 * One key per step: `sourceId#indexWithinSource`, then the lexicographically
 * smallest ROTATION of that list.
 *
 * The rotation is the whole point. The same cyclic combination is reachable
 * from every card-A step it passes through, and a 4-fold symmetric card
 * therefore finds it four times. Keying on the per-STEP list rather than on the
 * blocks makes those phases identical strings, which is what collapses them.
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
 * Can card-B material be REACHED from card-A material at all?
 *
 * Walk the union seam graph forward from every seam a card-A step starts at. A
 * combination contains at least one step of each card, so it contains a path
 * from some card-A seam to some card-B seam; if the BFS never arrives at one,
 * no such walk exists AT ANY LENGTH. That is the engine's only impossibility
 * proof, and it costs O(seams + steps) rather than an exponential sweep — which
 * is why AAAA + GGGG (alpha world vs beta world) is answered instantly instead
 * of being searched to the budget and reported as an unproven "none found".
 *
 * Empty inputs land here too: a card with no steps contributes no seams, so
 * nothing of its kind is ever reachable.
 */
function cardBIsReachableFromCardA(
  sources: readonly WalkSource[],
  sourceSteps: readonly (readonly StepData[])[]
): boolean {
  const edges = new Map<SeamState, Set<SeamState>>();
  const frontier: SeamState[] = [];
  const cardBSeams = new Set<SeamState>();

  sourceSteps.forEach((steps, sourceIndex) => {
    const kind = sources[sourceIndex]!.kind;
    for (const step of steps) {
      const from = seamOf(step);
      const to = seamEndOf(step);
      if (!from || !to) continue;

      const out = edges.get(from);
      if (out) out.add(to);
      else edges.set(from, new Set([to]));

      if (kind === "cardA") frontier.push(from);
      if (kind === "cardB") cardBSeams.add(from);
    }
  });

  if (cardBSeams.size === 0) return false;

  const seen = new Set<SeamState>(frontier);
  while (frontier.length > 0) {
    const seam = frontier.pop()!;
    if (cardBSeams.has(seam)) return true;
    for (const next of edges.get(seam) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      frontier.push(next);
    }
  }
  return false;
}

/**
 * Every closed alternating walk over card A and card B, within the requested
 * bounds — or a structural proof that none exists at any length.
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
      Math.max(
        options.maxResultLength ?? COMBINATOR_DEFAULTS.maxResultLength,
        MIN_RESULT_LENGTH
      ),
      HARD_MAX_RESULT_LENGTH
    ),
  };

  /** A structural proof covers every length, so nothing is left unexplored. */
  const proven = (gridModeMismatch: boolean): CombinationSearchReport => ({
    results: [],
    impossible: true,
    // Synthesized, not measured: the structural proof holds at every length, so
    // the whole requested depth is covered without a single node being visited.
    searchedToLength: opts.maxResultLength,
    resultsTruncated: false,
    budgetExhausted: false,
    searchComplete: true,
    gridModeMismatch,
  });

  // Odd rotations are the only transform that changes grid mode, and the
  // variant generator never emits one — so two cards in different modes share
  // no reachable seam at all.
  if ((cardA.gridMode ?? "diamond") !== (cardB.gridMode ?? "diamond")) {
    return proven(true);
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

  if (!cardBIsReachableFromCardA(sources, sourceSteps)) {
    return proven(false);
  }

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
  let resultsTruncated = false;
  let budgetExhausted = false;
  let stopped = false;

  const record = (blocks: readonly WalkBlock[], totalSteps: number): void => {
    const partition = canonicalPartition(blocks, lengthOfSource);
    const signature = canonicalWalkSignature(partition, lengthOfSource);

    const existing = rawWalks.get(signature);
    if (existing) {
      // The same cyclic walk, entered at a different card-A step. Prefer the
      // representative whose blocks are fewest — with wrap-splits already
      // rejoined the partitions agree, so this only ever settles ties.
      if (partition.length < existing.blocks.length) {
        rawWalks.set(signature, { blocks: partition, totalSteps, signature });
      }
      return;
    }

    rawWalks.set(signature, { blocks: partition, totalSteps, signature });
    if (rawWalks.size >= rawWalkCap) {
      stopped = true;
      resultsTruncated = true;
    }
  };

  /**
   * Card-A material is present from the first step — every anchor is a card-A
   * source — so only card B has to be PROVEN present before a walk may close.
   * That asymmetry is why `usedCardB` has no `usedCardA` twin.
   *
   * @param startSeam   where the walk began; closure means returning here
   * @param currentSeam where the walk stands now
   * @param sourceIndex the source the current (uncommitted) block belongs to
   * @param nextIndex   the next step of that source, cyclically
   * @param blockSteps  steps of the current block, not yet committed
   * @param blockStart  index the current block entered its source at
   * @param blocks      committed blocks
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
    usedCardB: boolean
  ): void => {
    if (stopped) return;
    if (budget <= 0) {
      budgetExhausted = true;
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
      usedCardB
    ) {
      record(
        [...blocks, commitBlock(source, blockStart, blockSteps)],
        totalSteps
      );
      if (stopped) return;
    }

    if (totalSteps >= limit || steps.length === 0) return;

    // Extend: stay in this source and take its next step.
    const extendIndex = nextIndex % steps.length;
    const nextStep = steps[extendIndex]!;
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
        usedCardB || source.kind === "cardB"
      );
      if (stopped) return;
    }

    if (blockSteps.length < opts.minBlockSize) return;

    // Jump: hand off to any step sitting at this seam, including one in the
    // SAME source at a different phase. A card that revisits a seam (FALG is at
    // beta5 twice) can legitimately be re-entered elsewhere in its own cycle —
    // forbidding that would silently drop real combinations, and the
    // both-cards close rule already guarantees a result is not one card alone.
    // The single exclusion is the step the extend branch above just took: the
    // same walk, split into two blocks for no reason.
    const committed = commitBlock(source, blockStart, blockSteps);
    for (const entry of entries.get(currentSeam) ?? []) {
      if (
        entry.sourceIndex === sourceIndex &&
        entry.stepIndex === extendIndex
      ) {
        continue;
      }
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
        usedCardB || target.kind === "cardB"
      );
      if (stopped) return;
    }
  };

  // Anchor at every card-A source, identity AND twin. A combination whose only
  // card-A material comes from the twin is a real combination; anchoring solely
  // on the identity source would make it unreachable. Canonical dedup keeps the
  // extra anchors from duplicating anything.
  const anchorSourceIndices = sources
    .map((source, index) => ({ kind: source.kind, index }))
    .filter((entry) => entry.kind === "cardA")
    .map((entry) => entry.index);

  let searchedToLength = 0;
  for (
    let limit = MIN_RESULT_LENGTH;
    limit <= opts.maxResultLength && !stopped;
    limit++
  ) {
    for (const sourceIndex of anchorSourceIndices) {
      if (stopped) break;
      const steps = sourceSteps[sourceIndex]!;
      for (let start = 0; start < steps.length && !stopped; start++) {
        const step = steps[start]!;
        const seam = seamOf(step);
        const end = seamEndOf(step);
        if (!seam || !end) continue;
        visit(
          limit,
          seam,
          end,
          sourceIndex,
          start + 1,
          [step],
          start,
          [],
          1,
          false
        );
      }
    }
    if (!stopped) searchedToLength = limit;
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
    // Never claimed from an empty bounded search — the precheck above is the
    // only thing that can prove it, and it already returned if it held.
    impossible: false,
    searchedToLength,
    resultsTruncated,
    budgetExhausted,
    searchComplete:
      !resultsTruncated &&
      !budgetExhausted &&
      searchedToLength >= opts.maxResultLength,
    gridModeMismatch: false,
  };
}
