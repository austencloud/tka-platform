import type { StepData } from "$lib/features/create/shared/domain/models/StepData";

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
 * Relationship between two steps in a sequence
 */
export interface StepPairRelationship {
  keyStep: number;
  correspondingStep: number;
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
export interface IStepPairAnalyzer {
  /**
   * Analyze a pair of steps and detect LOOP transformations
   */
  analyzeBeatPair(step1: StepData, step2: StepData): StepPairRelationship;
}
