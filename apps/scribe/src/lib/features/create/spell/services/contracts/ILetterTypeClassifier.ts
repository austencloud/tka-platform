/**
 * Letter Type Classifier Service Interface
 *
 * Classifies TKA letters into their 6 type categories and provides
 * filtering capabilities based on letter type.
 */

import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { LetterType } from "$lib/shared/foundation/domain/models/LetterType";

export interface ILetterTypeClassifier {
  /**
   * Classify a letter into its type (1-6).
   *
   * Type 1: Dual-Shift (A-V)
   * Type 2: Shift (W, X, Y, Z, Σ, Δ, Θ, Ω, μ, ν)
   * Type 3: Cross-Shift (W-, X-, Y-, Z-, Σ-, Δ-, Θ-, Ω-)
   * Type 4: Dash (Φ, Ψ, Λ)
   * Type 5: Dual-Dash (Φ-, Ψ-, Λ-)
   * Type 6: Static (α, β, γ, ζ, η, τ, ⊕)
   *
   * @param letter - The letter to classify
   * @returns The letter type
   */
  classify(letter: Letter): LetterType;

  /**
   * Get all letters of a specific type.
   *
   * @param type - The letter type to filter by
   * @returns Array of letters matching the type
   */
  getLettersOfType(type: LetterType): Letter[];

  /**
   * Check if a letter belongs to a specific type.
   *
   * @param letter - The letter to check
   * @param type - The type to check against
   * @returns True if the letter is of the specified type
   */
  isType(letter: Letter, type: LetterType): boolean;
}
