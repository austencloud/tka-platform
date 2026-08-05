/**
 * Raw walks -> ranked, labelled `CombinationResult`s.
 *
 * The search hands over closed walks in shortest-first order, deduped by walk
 * SIGNATURE (which sources, at which phases). Three things still have to happen
 * before a human can read the list:
 *
 *   1. **A verdict.** The block shape says how the two cards actually met —
 *      played back to back (SEQUENTIAL), interleaved a whole unit at a time
 *      (FUSED), cut inside a unit (BRAIDED), or none of those cleanly (HYBRID).
 *   2. **Content dedup.** Two walks over DIFFERENT sources can build the same
 *      sequence — a symmetric card's identity and its rotated variant contain
 *      literally the same steps — and the search cannot see that, because it
 *      keys on source identity. The built sequence's canonical hash can, so the
 *      hash is taken after `buildResult` and the first walk to produce a given
 *      sequence wins. The search's shortest-first order makes "first" mean
 *      "smallest", which is the representative worth keeping.
 *   3. **Ranking.** See {@link rankResults} — the search's shortest-first order
 *      is deliberately NOT the presentation order.
 *
 * Results whose sequence carries `metadata.incompleteWord` are DROPPED rather
 * than shown. That flag means some spliced step is not a dataframe row, so the
 * result cannot be labelled honestly, cannot be saved, and cannot mint a
 * shortcode — surfacing it would only offer the user something that breaks
 * downstream. The count is warned once per search rather than per result.
 */

import { getSequenceCanonicalizer } from "$lib/shared/comparison/get-sequence-canonicalizer";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";

import type {
  CombinationResult,
  CombinatorTunables,
  Verdict,
  VariantDescriptor,
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

// ---------------------------------------------------------------------------
// Repeat units
// ---------------------------------------------------------------------------

/**
 * One letter unit: a letter optionally followed by its dash suffix, so "Φ-Ψ-"
 * counts as two units rather than four characters.
 *
 * `word-simplifier` has the same tokenizer, but keeps it private; counting is
 * the only part of it this module needs, and reaching for a duplicate
 * SIMPLIFIER (rather than a two-line counter) is what `never-hand-roll` is
 * actually about.
 */
const LETTER_UNIT = /[A-Za-zͰ-Ͽἀ-῿]-?/g;

function letterUnitCount(word: string): number {
  return word.match(LETTER_UNIT)?.length ?? 0;
}

/**
 * Steps in ONE repeat unit of a card — the grain the verdicts are measured in.
 *
 * A card's word is its realized letter run, so the simplified word's letter
 * count IS its unit in steps: GGGG simplifies to "G", so its unit is 1 and
 * every single-step G block is already a whole unit. FALG simplifies to itself,
 * so its unit is 4 and a 2-step slice of it is a cut INSIDE a unit — which is
 * exactly the distinction BRAIDED exists to name.
 *
 * Falls back to the whole card when the word is missing or unreadable: with no
 * word there is no evidence of repetition, and treating the card as one
 * indivisible unit is the claim that assumes least.
 */
function repeatUnitSteps(card: SequenceData): number {
  const stepCount = card.steps.length;
  const word = card.word ?? "";
  if (!word) return Math.max(stepCount, 1);

  const unit = letterUnitCount(simplifyRepeatedWord(word));
  if (unit <= 0) return Math.max(stepCount, 1);
  return stepCount > 0 ? Math.min(unit, stepCount) : unit;
}

/** The unit a block is measured against; null for ambient (no card grain). */
function unitOf(block: WalkBlock, unitA: number, unitB: number): number | null {
  if (block.kind === "cardA") return unitA;
  if (block.kind === "cardB") return unitB;
  return null;
}

function isWholeUnit(block: WalkBlock, unitA: number, unitB: number): boolean {
  const unit = unitOf(block, unitA, unitB);
  return unit === null || block.steps.length % unit === 0;
}

function isSubUnit(block: WalkBlock, unitA: number, unitB: number): boolean {
  const unit = unitOf(block, unitA, unitB);
  return unit !== null && block.steps.length < unit;
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

/**
 * How the two cards met, read off the block shape.
 *
 * Ambient blocks are excluded from every count here: bridge material is
 * connective tissue, not one of the two things being combined, so a ΦΨ bridge
 * dropped between the two halves of a concatenation must not turn SEQUENTIAL
 * into something else. `usedAmbient` is where that shows up instead.
 *
 * Alternation is read along the block list, not around the cyclic wrap. The
 * partition is canonical (`canonicalPartition` rejoins wrap-split runs), so a
 * first and last block of the same KIND are two separate runs of that card —
 * a re-entry — and an odd number of card blocks can still be a clean
 * whole-unit interleave.
 */
export function classifyBlocks(
  blocks: readonly WalkBlock[],
  unitA: number,
  unitB: number
): Verdict {
  const cardBlocks = blocks.filter((block) => block.kind !== "ambient");

  // Two runs, one per card: the cards were played one after the other.
  if (cardBlocks.length === 2) return "SEQUENTIAL";

  const alternating = cardBlocks.every(
    (block, i) => i === 0 || block.kind !== cardBlocks[i - 1]!.kind
  );
  const allWhole = cardBlocks.every((block) =>
    isWholeUnit(block, unitA, unitB)
  );
  if (cardBlocks.length > 2 && alternating && allWhole) return "FUSED";

  // A block shorter than its own card's unit is a cut INSIDE a repeat — the
  // cards are woven at a finer grain than either was written in.
  if (cardBlocks.some((block) => isSubUnit(block, unitA, unitB))) {
    return "BRAIDED";
  }

  return "HYBRID";
}

// ---------------------------------------------------------------------------
// Derivation sentence
// ---------------------------------------------------------------------------

/**
 * A card's DISPLAY word: the simplified form, always (per
 * `simplified-word-display.md` — GGGG is shown as G, never as GGGG).
 *
 * Falls back to the card's name, then to a visible placeholder. An unnamed card
 * is a real state (a work-in-progress sequence handed to the combinator), and
 * "(unnamed)" says so; inventing a label from the step data would be worse.
 */
function displayWord(card: SequenceData): string {
  const raw = card.word || card.name || "";
  return raw ? simplifyRepeatedWord(raw) : "(unnamed)";
}

/** Ambient bases the walk drew on, in order of first appearance. */
function ambientWordsOf(blocks: readonly WalkBlock[]): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const block of blocks) {
    const word = block.ambientWord;
    if (!word || seen.has(word)) continue;
    seen.add(word);
    words.push(word);
  }
  return words;
}

/**
 * "= FALG + G" — the ingredient sentence, in display words.
 *
 * Ambient bases are appended as further ingredients, because that is what they
 * are: the result really does contain ΦΨ material and hiding it would make the
 * sentence a lie. The rotation-faithful marker is appended when any block came
 * from a twin source — the seams where the prop keeps spinning while the hand
 * path reverses are the interesting thing about such a result, and they are
 * invisible in the word alone.
 */
function derivationOf(
  cardA: SequenceData,
  cardB: SequenceData,
  ambientWords: readonly string[],
  rotationFaithfulBlocks: number
): string {
  const ingredients = [
    displayWord(cardA),
    displayWord(cardB),
    ...ambientWords.map((word) => simplifyRepeatedWord(word)),
  ];
  const sentence = `= ${ingredients.join(" + ")}`;
  return rotationFaithfulBlocks > 0
    ? `${sentence} · rotation-faithful seams`
    : sentence;
}

// ---------------------------------------------------------------------------
// Content hash
// ---------------------------------------------------------------------------

/**
 * A content signature that does not depend on the canonicalizer.
 *
 * Per step: letter, both endpoints, and each hand's motion type + rotation
 * direction + turns + orientation transition. That is the material a performer
 * would call "the same beat"; ids and step numbers (which differ by
 * construction between two walks over different sources) are deliberately out.
 *
 * A closed walk has no start, so the signature is the lexicographically
 * smallest ROTATION of the per-step keys — the same trick the search uses on
 * its own walk signature, for the same reason.
 */
function fallbackContentHash(sequence: SequenceData): string {
  const keys = sequence.steps.map((step) => {
    const hands = (["blue", "red"] as const)
      .map((color) => {
        const motion = step.motions[color];
        return [
          motion?.motionType,
          motion?.rotationDirection,
          motion?.turns,
          motion?.startOrientation,
          motion?.endOrientation,
          motion?.startLocation,
          motion?.endLocation,
        ].join(",");
      })
      .join("|");
    return `${step.letter ?? "?"}@${step.startPosition}>${step.endPosition}:${hands}`;
  });

  let best = keys.join(">");
  for (let k = 1; k < keys.length; k++) {
    const rotated = [...keys.slice(k), ...keys.slice(0, k)].join(">");
    if (rotated < best) best = rotated;
  }
  return `content:${best}`;
}

let canonicalizerWarned = false;

/**
 * The dedup key. `SequenceCanonicalizer` is the codebase's own answer to "are
 * these the same sequence"; the combination engine is its first consumer, so
 * the fallback above is kept as a real safety net rather than dead code — a
 * step missing a hand makes `generateSignature` throw, and losing the whole
 * search to that would be a poor trade for a hash.
 */
function contentHash(sequence: SequenceData): string {
  try {
    return getSequenceCanonicalizer().canonicalize(sequence).canonicalHash;
  } catch (error) {
    if (!canonicalizerWarned) {
      canonicalizerWarned = true;
      console.warn(
        "[walk-classifier] sequence canonicalizer unavailable; " +
          "falling back to a content signature for dedup",
        error
      );
    }
    return fallbackContentHash(sequence);
  }
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

/**
 * Presentation order, most card-worthy first. This INTENTIONALLY overrides the
 * search's shortest-first emission order.
 *
 * Shortest-first is the right order for a SEARCH — it makes the deepening
 * terminate usefully and it proves the small cases exist. It is the wrong order
 * for a LIST: measured on GGGG + HHHH at Task 6, the shortest walks are
 * two-step "one G, one H" loops, and dozens of them crowd out every result that
 * looks like a card. So the ranking runs on what makes a combination worth
 * looking at instead:
 *
 *   1. Pure card material before anything that needed an ambient bridge.
 *   2. FUSED, SEQUENTIAL, HYBRID, BRAIDED — the interleave is the interesting
 *      answer, the concatenation is the obvious one, and a braid is the most
 *      exotic (and least likely to be what was asked for).
 *   3. Period ascending: a period-1 loop repeats seamlessly, a period-2 has to
 *      be played twice. Unknown period sorts last — it is not a claim.
 *   4. Material balance: a 50/50 result uses both cards, a 7-to-1 barely uses
 *      the second one.
 *   5. Distance from `lenA + lenB` — the "both full cards, fused" length.
 *      Austen's DJDJ + GGGG -> DJGGDJGG is 4 + 4 -> 8, and that shape should
 *      not lose to a 4-step half-measure that merely balances well.
 *   6. Brevity, so ties resolve toward the shorter loop.
 *
 * Stable throughout: `Array.prototype.sort` is stable, so equal-on-every-key
 * results keep the search's deterministic order.
 */
const VERDICT_ORDER: Record<Verdict, number> = {
  FUSED: 0,
  SEQUENTIAL: 1,
  HYBRID: 2,
  BRAIDED: 3,
};

export function rankResults(
  results: readonly CombinationResult[],
  fusedLength: number
): CombinationResult[] {
  const by = (result: CombinationResult) => ({
    ambient: result.usedAmbient ? 1 : 0,
    verdict: VERDICT_ORDER[result.verdict],
    period: result.sequence.period ?? Number.POSITIVE_INFINITY,
    imbalance: Math.abs(result.cardAShare - result.cardBShare),
    lengthGap: Math.abs(result.sequence.steps.length - fusedLength),
    length: result.sequence.steps.length,
  });

  return [...results].sort((a, b) => {
    const left = by(a);
    const right = by(b);
    return (
      left.ambient - right.ambient ||
      left.verdict - right.verdict ||
      left.period - right.period ||
      left.imbalance - right.imbalance ||
      left.lengthGap - right.lengthGap ||
      left.length - right.length
    );
  });
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

function variantKey(variant: VariantDescriptor): string {
  return `${variant.rotation}|${variant.mirrored}|${variant.colorSwapped}|${variant.rotationFaithful}`;
}

/**
 * Every distinct card-B variant the walk draws on, in order of first
 * appearance. One result legitimately mixes variants — see `variantsB`.
 */
function variantsUsed(
  blocks: readonly WalkBlock[],
  sourceById: ReadonlyMap<string, WalkSource>
): VariantDescriptor[] {
  const seen = new Set<string>();
  const variants: VariantDescriptor[] = [];
  for (const block of blocks) {
    if (block.kind !== "cardB") continue;
    const source = sourceById.get(block.sourceId);
    if (!source || source.kind === "ambient") continue;
    const key = variantKey(source.variant);
    if (seen.has(key)) continue;
    seen.add(key);
    variants.push(source.variant);
  }
  return variants;
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
 * Build, label, dedup and rank the search's walks, then take `maxResults`.
 *
 * The slice happens LAST, on purpose: slicing before the ranking would hand the
 * user the search's shortest-first order under a ranking's name.
 */
export async function classifyAndRank(
  walks: readonly RawWalk[],
  cardA: SequenceData,
  cardB: SequenceData,
  sources: readonly WalkSource[],
  options: CombinatorTunables
): Promise<CombinationResult[]> {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const unitA = repeatUnitSteps(cardA);
  const unitB = repeatUnitSteps(cardB);

  // Cheap pre-filter: a walk that cuts inside a repeat unit can be rejected on
  // its blocks alone, before paying for the orientation recalc and the letter
  // lookups `buildResult` runs.
  const candidates = options.wholeUnitsOnly
    ? walks.filter((walk) =>
        walk.blocks.every((block) => isWholeUnit(block, unitA, unitB))
      )
    : walks;

  const seen = new Set<string>();
  const results: CombinationResult[] = [];
  let incompleteDropped = 0;

  for (const walk of candidates) {
    const sequence = await buildResult(walk.blocks, cardA);

    if (sequence.metadata?.incompleteWord) {
      incompleteDropped++;
      continue;
    }

    const canonicalHash = contentHash(sequence);
    if (seen.has(canonicalHash)) continue;
    seen.add(canonicalHash);

    const cardASteps = stepsOfKind(walk.blocks, "cardA");
    const cardBSteps = stepsOfKind(walk.blocks, "cardB");
    const cardSteps = cardASteps + cardBSteps;
    const ambientWords = ambientWordsOf(walk.blocks);
    const rotationFaithfulBlocks = walk.blocks.filter(
      (block) => block.rotationFaithful
    ).length;

    results.push({
      sequence,
      blocks: walk.blocks,
      verdict: classifyBlocks(walk.blocks, unitA, unitB),
      usedAmbient: walk.blocks.some((block) => block.kind === "ambient"),
      ambientWords,
      cardAShare: cardSteps > 0 ? cardASteps / cardSteps : 0,
      cardBShare: cardSteps > 0 ? cardBSteps / cardSteps : 0,
      variantsB: variantsUsed(walk.blocks, sourceById),
      rotationFaithfulBlocks,
      canonicalHash,
      derivation: derivationOf(
        cardA,
        cardB,
        ambientWords,
        rotationFaithfulBlocks
      ),
    });
  }

  if (incompleteDropped > 0) {
    console.warn(
      `[walk-classifier] dropped ${incompleteDropped} of ${candidates.length} walks whose spliced ` +
        "material has no dataframe letter — an unlabelable sequence cannot be saved or shared."
    );
  }

  return rankResults(results, cardA.steps.length + cardB.steps.length).slice(
    0,
    options.maxResults
  );
}
