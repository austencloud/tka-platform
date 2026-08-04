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
  /** Rotation-faithful twin: motionType PRO↔ANTI flipped, rotation direction
   * and locations preserved — G-run becomes H-run (Austen's FLGGFLHH example).
   * NOT the LOOP "inverted" component: invertMotion in
   * create/services/motion-transforms.ts flips BOTH type and rotation
   * direction, which is a different transform, deliberately not used here. */
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
  readonly variantB: VariantDescriptor | null;
  /** Count of blocks taken from a rotation-faithful twin (see VariantDescriptor.rotationFaithful). */
  readonly rotationFaithfulBlocks: number;
  readonly canonicalHash: string;
  /** "= FL + AA + GG" style ingredient sentence. */
  readonly derivation: string;
}

export interface CombinationSearchReport {
  readonly results: readonly CombinationResult[];
  /** Derived at construction: results empty AND searchComplete. With ambient
   * enabled this is the strong impossibility claim. */
  readonly impossible: boolean;
  /** True when the bounded search exhausted the space. False = budget hit;
   * impossibility NOT proven, only "none found". */
  readonly searchComplete: boolean;
  readonly gridModeMismatch: boolean;
}

export interface AmbientOptionProvider {
  /** Candidate ambient steps STARTING at the given seam (letter-filtered). */
  optionsAt(seam: SeamState): Promise<readonly StepData[]>;
}

export interface CombinatorTunables {
  readonly minBlockSize: number;
  readonly maxResultLength: number;
  readonly maxResults: number;
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
