/**
 * Raw walks -> ranked, labelled `CombinationResult`s.
 *
 * STUB — Task 8 replaces this with the real classifier: SEQUENTIAL / FUSED /
 * BRAIDED / HYBRID verdicts from the block shape, content-level dedup through
 * `SequenceCanonicalizer` (two walks over different-but-identical sources
 * produce the same sequence and must collapse), a derivation sentence naming
 * the ingredients, and ranking.
 *
 * Today it is a faithful pass-through: the search already dedups walks that are
 * rotations of one another and already orders them shortest-first, so the honest
 * stub keeps that order, takes the first `maxResults`, and fills in the fields
 * that are pure arithmetic over the blocks. Verdict is "HYBRID" for everything
 * and `derivation` is empty rather than guessed — a wrong label is worse than a
 * missing one.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

import type {
  CombinationResult,
  CombinatorTunables,
  WalkBlock,
  WalkSource,
} from "../domain/types";
import { buildResult } from "./splice-builder";

/** One closed walk as the search found it, before any interpretation. */
export interface RawWalk {
  readonly blocks: readonly WalkBlock[];
  readonly totalSteps: number;
  /**
   * Rotation-canonical `sourceId#stepIndex` signature — the search's dedup key,
   * unique across the walks handed here.
   */
  readonly signature: string;
}

function stepsOfKind(
  blocks: readonly WalkBlock[],
  kind: WalkBlock["kind"]
): number {
  let total = 0;
  for (const block of blocks) {
    if (block.kind === kind) total += block.steps.length;
  }
  return total;
}

/**
 * Build a `CombinationResult` per walk, shortest-first, capped at `maxResults`.
 *
 * `cardA`/`cardB` are the untransformed inputs; only card A is consumed here
 * (as the splice frame). Task 8 uses both for the derivation sentence.
 */
export async function classifyAndRank(
  walks: readonly RawWalk[],
  cardA: SequenceData,
  _cardB: SequenceData,
  sources: readonly WalkSource[],
  options: CombinatorTunables
): Promise<CombinationResult[]> {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const results: CombinationResult[] = [];

  for (const walk of walks.slice(0, options.maxResults)) {
    const sequence = await buildResult(walk.blocks, cardA);

    const cardASteps = stepsOfKind(walk.blocks, "cardA");
    const cardBSteps = stepsOfKind(walk.blocks, "cardB");
    const cardSteps = cardASteps + cardBSteps;

    const firstB = walk.blocks.find((block) => block.kind === "cardB");
    const bSource = firstB ? sourceById.get(firstB.sourceId) : undefined;

    results.push({
      sequence,
      blocks: walk.blocks,
      // STUB — Task 8 derives the real verdict from the block shape.
      verdict: "HYBRID",
      usedAmbient: walk.blocks.some((block) => block.kind === "ambient"),
      ambientWords: [],
      cardAShare: cardSteps > 0 ? cardASteps / cardSteps : 0,
      cardBShare: cardSteps > 0 ? cardBSteps / cardSteps : 0,
      variantB: bSource && bSource.kind !== "ambient" ? bSource.variant : null,
      rotationFaithfulBlocks: walk.blocks.filter(
        (block) => block.rotationFaithful
      ).length,
      canonicalHash: walk.signature,
      // STUB — Task 8 writes the "= GG + HH" ingredient sentence.
      derivation: "",
    });
  }

  return results;
}
