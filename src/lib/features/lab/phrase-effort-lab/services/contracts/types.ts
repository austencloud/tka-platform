// --- From PhraseInterpolator ---

export interface PhraseInterpolationResult {
  /** 0-based step index in the sequence */
  stepIndex: number;
  /** Progress within that step (0.0 to 1.0) */
  localProgress: number;
}

// === From IPhraseInterpolator ===

export interface PhraseInterpolationResult {
  /** 0-based step index in the sequence */
  stepIndex: number;
  /** Progress within that step (0.0 to 1.0) */
  localProgress: number;
}
