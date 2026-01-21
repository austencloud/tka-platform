/**
 * ITikaSequenceGenerator - Contract for TKA Sequence Generation
 *
 * Generates valid, connected TKA sequences from letter arrays.
 * Handles position chaining and variation selection.
 */

export interface SequenceStepMotion {
  motionType: string;
  startLocation: string;
  endLocation: string;
  rotationDirection: string;
}

export interface SequenceStep {
  letter: string;
  variation: number;
  startPosition: string;
  endPosition: string;
  stepNumber: number;
  blueMotion: SequenceStepMotion;
  redMotion: SequenceStepMotion;
}

export interface SequenceResult {
  word: string;
  steps: SequenceStep[];
  startPosition: string;
  endPosition: string;
  isValid: boolean;
  error?: string;
}

export interface ITikaSequenceGenerator {
  /**
   * Generate a valid connected sequence from letters.
   * Uses random variation selection with position chaining.
   *
   * @param letters - Array of TKA letters
   * @param maxAttempts - Maximum attempts to find a valid chain (default 100)
   * @returns Sequence result with steps or error
   */
  generateSequence(letters: string[], maxAttempts?: number): Promise<SequenceResult>;

  /**
   * Get the Type 6 static letters (α, β, γ)
   */
  getStaticLetters(): string[];
}
