import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";

/**
 * Letter relationship types detected between beat pairs
 */
export interface LetterRelationshipInfo {
  letter1: string;
  letter2: string;
  /** Formal letter transformation relationships */
  relationships: {
    isInverted: boolean; // Pro ↔ Anti (A↔B, Σ↔Δ)
    isCompound: boolean; // Section transition pairs (D↔J, M↔P)
    isAlphaBetaCounterpart: boolean; // Gamma endpoint sharing (Σ↔Θ, W↔Y)
  };
  /** Human-readable summary of the relationship */
  summary: string;
}

/**
 * Relationship between two beats in a sequence
 */
export interface BeatPairRelationship {
  keyBeat: number;
  correspondingBeat: number;
  /** Primary transformation (contextual, after priority filtering) */
  detectedTransformations: string[]; // e.g., ["ROTATED 180+SWAPPED"]
  /** All valid transformations this pair satisfies (before filtering) */
  allValidTransformations?: string[]; // e.g., ["ROTATED 180+SWAPPED", "MIRRORED+INVERTED"]
  confirmedTransformation?: string; // User-selected interpretation
  /** Letter-based relationship analysis */
  letterRelationship?: LetterRelationshipInfo;
}

/**
 * Service for analyzing relationships between beat pairs
 */
export interface IBeatPairAnalyzer {
  /**
   * Analyze a pair of beats and detect LOOP transformations
   */
  analyzeBeatPair(beat1: BeatData, beat2: BeatData): BeatPairRelationship;
}
