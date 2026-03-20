/**
 * LOOP Explainer Interface
 *
 * Generates plain-English explanations of LOOP patterns for display
 * on choreo card backs. Handles both simple LOOPs (one transformation)
 * and modular LOOPs (multiple seeds with independent nested transformations).
 *
 * The LOOPDetector answers "is this a LOOP and what components?"
 * The LOOPExplainer answers "what does this LOOP mean in plain English?"
 */

import type { LOOPComponent } from "$lib/features/create/generate/shared/domain/models/generate-models";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface SeedInfo {
  /** Display name for this seed (e.g. "AA", "KE") */
  name: string;
  /** Which beat indices (1-based) belong to each occurrence of this seed */
  beatRanges: [number, number][];
}

export interface SeedTransformation {
  seed: string;
  transformations: {
    component: LOOPComponent;
    interval: string;
    description: string;
  }[];
}

export interface LOOPExplanation {
  type: "simple" | "modular";
  seeds: SeedInfo[];
  seedTransformations: SeedTransformation[];
  cycleCount: number;
  /** Plain-English description for the card back */
  summary: string;
}

export interface ILOOPExplainer {
  explain(
    sequence: SequenceData,
    loopComponents: Set<LOOPComponent>
  ): LOOPExplanation;
}
