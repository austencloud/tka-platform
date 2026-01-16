/**
 * Domain models for step-pair relationship analysis
 */

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

export interface StepPairRelationship {
  keyStep: number;
  correspondingStep: number;
  detectedTransformations: string[]; // e.g., ["FLIPPED", "ROTATED_180 + SWAPPED"]
  allValidTransformations?: string[]; // All valid transformations before filtering
  confirmedTransformation?: string; // User-selected interpretation
  /** Letter-based relationship analysis */
  letterRelationship?: LetterRelationshipInfo;
}
