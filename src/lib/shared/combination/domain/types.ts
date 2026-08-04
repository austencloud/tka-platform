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
  /** Rotation-faithful twin: every motion's rotation direction flipped,
   * letters re-derived (G-run becomes H-run). */
  readonly inverted: boolean;
}

export interface WalkSource {
  readonly id: string; // "A", "A~inv", "B r2 mirror swap", "ambient:ΦΨ"
  readonly kind: "cardA" | "cardB" | "ambient";
  readonly variant: VariantDescriptor;
  /** Concrete cyclic material. Ambient sources have no fixed sequence —
   * their steps come from the option provider at search time. */
  readonly sequence: SequenceData | null;
  readonly ambientWord?: string;
}

export interface WalkBlock {
  readonly sourceId: string;
  readonly kind: WalkSource["kind"];
  /** Step index in the source where this block entered (cyclic). -1 for ambient. */
  readonly startStepIndex: number;
  readonly steps: readonly StepData[];
  readonly inverted: boolean;
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
  readonly cardAMaterial: number;
  readonly cardBMaterial: number;
  readonly variantB: VariantDescriptor | null;
  /** Count of blocks taken from an inverted twin (rotation-faithful seams). */
  readonly invertedBlocks: number;
  readonly canonicalHash: string;
  /** "= FL + AA + GG" style ingredient sentence. */
  readonly derivation: string;
}

export interface CombinatorVerdictReport {
  readonly results: readonly CombinationResult[];
  /** True when the exhaustive bounded search found nothing — with ambient
   * enabled this is the strong impossibility claim. */
  readonly impossible: boolean;
  /** Search hit a safety cap before exhausting the space; impossibility is
   * then NOT proven, only "none found". */
  readonly exhausted: boolean;
  readonly gridModeMismatch: boolean;
}

export interface CombinatorOptions {
  readonly minBlockSize?: number; // default 1
  readonly maxResultLength?: number; // default 32, hard cap 64
  readonly maxResults?: number; // default 24
  readonly wholeUnitsOnly?: boolean; // default false
  readonly allowAmbient?: boolean; // default true
  readonly maxAmbientRun?: number; // default 2 consecutive ambient steps
  readonly allowMirror?: boolean; // default true
  readonly allowRotation?: boolean; // default true
  readonly allowColorSwap?: boolean; // default true
  readonly exploreRotationFaithful?: boolean; // default true
  /** DFS node budget before exhausted=false is reported. Default 200_000. */
  readonly searchBudget?: number;
}

export interface SeamEntry {
  readonly sourceIndex: number;
  readonly stepIndex: number;
}
