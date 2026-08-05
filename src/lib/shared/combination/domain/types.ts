/**
 * Domain model for the sequence-combination engine: a seam-graph closed-walk
 * search over two source cards (A, B) plus an optional ambient base
 * vocabulary. Consumed by `combination/services/*` and the
 * `/test/sequence-combinator` lab.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

/** A seam is the total position between steps — a GridPosition value ("beta5"). */
export type SeamState = GridPosition;

/** Spatial/color/invert variant applied to card B (or the invert twin of A). */
export interface VariantDescriptor {
  /** 45°-step rotation, even values only in v1 (grid mode preserved). */
  readonly rotation: 0 | 2 | 4 | 6;
  readonly mirrored: boolean;
  readonly colorSwapped: boolean;
  /**
   * Rotation-faithful twin: the card traversed BACKWARDS while every prop keeps
   * rotating the way it already was. Step order reverses, each step's
   * start/end position and each motion's start/end location+orientation swap,
   * `rotationDirection` is PRESERVED, and `motionType` + letters are re-derived
   * from the result. See `services/variant-generator.ts`.
   *
   * That models Austen's FLGGFLHH card: the prop rotation flows continuously
   * while the hand path reverses, and the G-run reads as an H-run as a
   * consequence. "Rotation direction AND locations preserved" is impossible —
   * motionType is a FUNCTION of (hand path, rotation direction, turns), which
   * is what `deriveMotionType` computes, so flipping PRO↔ANTI while holding
   * both produces rows that do not exist in the dataframe. Proven by the
   * fixtures: twin(GGGG_CW) = HHHH_CW (beta1→7→5→3, anti + cw).
   *
   * NOT the LOOP "inverted" component: invertMotion in
   * create/services/motion-transforms.ts flips BOTH type and rotation
   * direction, keeping the hand path — a different transform, deliberately not
   * used here.
   */
  readonly rotationFaithful: boolean;
}

export type WalkSource =
  | {
      readonly kind: "cardA" | "cardB";
      readonly id: string; // "A", "A~inv", "B r2 mirror swap"
      readonly variant: VariantDescriptor;
      readonly sequence: SequenceData;
    }
  | {
      readonly kind: "ambient";
      readonly id: string; // "ambient:ΦΨ"
      readonly ambientWord: string;
    };

export interface WalkBlock {
  readonly sourceId: string;
  readonly kind: WalkSource["kind"];
  /** Step index in the source where this block entered (cyclic). -1 for ambient. */
  readonly startStepIndex: number;
  readonly steps: readonly StepData[];
  readonly rotationFaithful: boolean;
  readonly ambientWord?: string;
}

export type Verdict = "SEQUENTIAL" | "FUSED" | "BRAIDED" | "HYBRID";

export interface CombinationResult {
  readonly sequence: SequenceData;
  readonly blocks: readonly WalkBlock[];
  readonly verdict: Verdict;
  readonly usedAmbient: boolean;
  readonly ambientWords: readonly string[];
  /** Fractions of result steps drawn from each card (ambient excluded). */
  readonly cardAShare: number;
  readonly cardBShare: number;
  /**
   * Every DISTINCT card-B variant the result draws on, in order of first
   * appearance. A list, not a single descriptor: mixing variants inside one
   * combination is canon, not an edge case — Austen's own FALG card is the
   * identity half of its material followed by the colour-mirrored half, and a
   * single-variant field could not express it.
   *
   * Empty only for a result with no card-B block, which the search never emits.
   */
  readonly variantsB: readonly VariantDescriptor[];
  /** Count of blocks taken from a rotation-faithful twin (see VariantDescriptor.rotationFaithful). */
  readonly rotationFaithfulBlocks: number;
  /**
   * `SequenceCanonicalizer`'s hash for this sequence — a LABEL for other
   * modules that already speak that dialect, NOT what the engine deduped on.
   * It is not phase-invariant (three defects documented on
   * `walk-classifier.contentDedupKey`), so two entries could in principle
   * carry the same value; use `contentDedupKey(result.sequence)` for identity.
   */
  readonly canonicalHash: string;
  /** "= FL + AA + GG" style ingredient sentence. */
  readonly derivation: string;
}

export interface CombinationSearchReport {
  readonly results: readonly CombinationResult[];
  /**
   * A PROOF that no combination exists at ANY length — never merely "the
   * search found nothing".
   *
   * Only a structural argument can establish this, because the walk search is
   * bounded and a bounded search that comes back empty has proven nothing. The
   * two structural arguments the engine makes: the cards are in different grid
   * modes, or no card-B seam is REACHABLE from any card-A seam in the union
   * seam graph (`gridModeMismatch` distinguishes them). Everything else
   * reports `impossible: false` and lets `searchedToLength` carry the weaker,
   * honest claim.
   */
  readonly impossible: boolean;
  /**
   * The deepest walk length the search fully explored. "No results and
   * `searchedToLength` 6" is the true statement a bounded search can make:
   * no combination of 6 steps or fewer exists. 0 = nothing was fully explored.
   *
   * It is a floor on COVERAGE, not a ceiling on the results: when the raw-walk
   * cap (or the budget) fires part-way through a level, the walks that level
   * already recorded are kept, so results LONGER than `searchedToLength` may
   * well be present. Read it as "everything up to here was seen", never as
   * "nothing longer than this was returned".
   */
  readonly searchedToLength: number;
  /**
   * The raw-walk cap fired: MORE combinations exist than were collected. A
   * healthy signal on a rich pair, not an error — the caller asked for
   * `maxResults` and the space is bigger than that.
   */
  readonly resultsTruncated: boolean;
  /** The DFS node budget ran out mid-sweep. */
  readonly budgetExhausted: boolean;
  /**
   * Neither cap fired AND the deepening reached `maxResultLength` — the
   * bounded space was swept completely.
   */
  readonly searchComplete: boolean;
  readonly gridModeMismatch: boolean;
}

export interface AmbientOptionProvider {
  /** Candidate ambient steps STARTING at the given seam (letter-filtered). */
  optionsAt(seam: SeamState): Promise<readonly StepData[]>;
}

export interface CombinatorTunables {
  readonly minBlockSize: number;
  /** Clamped by the search to [2, 64]: a closed walk needs at least two steps. */
  readonly maxResultLength: number;
  /** How many ranked results the caller wants back. A PRESENTATION size. */
  readonly maxResults: number;
  /**
   * How many raw closed walks the search collects before it stops deepening.
   *
   * Deliberately NOT derived from `maxResults`. The two answer different
   * questions: `maxResults` is how much of the answer to show, `rawWalkCap` is
   * how much of the space to look at. Tying them (it was `maxResults * 8`)
   * meant asking for a smaller page also made the search shallower — a page of
   * 24 stopped the deepening at 192 walks, which on GGGG + HHHH is reached
   * while still enumerating two- and four-step loops, so the eight-step shapes
   * the ranking exists to promote were never collected at all.
   *
   * `searchBudget` still bounds the actual work; this bounds the harvest.
   *
   * Measured on GGGG + HHHH at these defaults (2026-08-04): 4096 walks in
   * ~190ms, deepening fully explored to length 5 and truncated part-way
   * through 6. Reaching length 8 — the "both full cards" shape ranking key 5
   * aims at — needs BOTH a bigger cap and a bigger budget (16384 / 2_000_000
   * gets there in ~700ms); at 4096 the harvest cap binds first, and at the
   * default 200_000 nodes the budget binds right behind it.
   */
  readonly rawWalkCap: number;
  /**
   * Keep only walks whose every card block is a whole multiple of that card's
   * REPEAT UNIT — the simplified word's letter count, so GGGG's unit is one
   * step and FALG's is four. Applied by the classifier before anything is
   * built, so it costs nothing but the block arithmetic.
   */
  readonly wholeUnitsOnly: boolean;
  readonly allowAmbient: boolean;
  readonly maxAmbientRun: number;
  readonly allowMirror: boolean;
  readonly allowRotation: boolean;
  readonly allowColorSwap: boolean;
  readonly exploreRotationFaithful: boolean;
  readonly searchBudget: number;
}

export const COMBINATOR_DEFAULTS: CombinatorTunables = {
  minBlockSize: 1,
  maxResultLength: 32,
  maxResults: 24,
  rawWalkCap: 4096,
  wholeUnitsOnly: false,
  allowAmbient: true,
  maxAmbientRun: 2,
  allowMirror: true,
  allowRotation: true,
  allowColorSwap: true,
  exploreRotationFaithful: true,
  searchBudget: 200_000,
};

export interface CombinatorOptions extends Partial<CombinatorTunables> {
  /** Injected collaborator (no default; ambient disabled without it). */
  readonly ambientProvider?: AmbientOptionProvider;
}
