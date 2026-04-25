/**
 * Letter Classifier
 *
 * Determines letter types and orientation characteristics for special placement logic.
 */

import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import type { ILetterClassifier } from "../contracts/ILetterClassifier";


export class LetterClassifier implements ILetterClassifier {
  private static readonly HYBRID_LETTERS = [
    "C",
    "F",
    "I",
    "L",
    "O",
    "R",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
    "W-",
    "X-",
    "Y-",
    "Z-",
    "Σ",
    "Δ",
    "Θ",
    "Ω",
    "Σ-",
    "Δ-",
    "Θ-",
    "Ω-",
    "Φ",
    "Ψ",
    "Λ",
  ];

  private static readonly IN = "in";
  private static readonly OUT = "out";

  /**
   * Check if letter is HYBRID (uses motion type keys for special placement)
   */
  isHybridLetter(letter: string): boolean {
    return LetterClassifier.HYBRID_LETTERS.includes(letter);
  }

  /**
   * Check if pictograph starts from standard orientation (both motions same layer)
   */
  startsFromStandardOrientation(pictographData: PictographData): boolean {
    try {
      const blueMotion = pictographData.motions.blue;
      const redMotion = pictographData.motions.red;

      if (!blueMotion || !redMotion) {
        return true; // Default to standard
      }

      const blueStart = blueMotion.startOrientation || "";
      const redStart = redMotion.startOrientation || "";

      // Standard if both are layer1 (IN/OUT) or both are layer2 (CLOCK/COUNTER)
      const blueLayer1 = [LetterClassifier.IN, LetterClassifier.OUT].includes(
        blueStart
      );
      const redLayer1 = [LetterClassifier.IN, LetterClassifier.OUT].includes(
        redStart
      );

      return blueLayer1 === redLayer1; // Same layer = standard orientation
    } catch {
      return true; // Default to standard
    }
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of letterClassifier to avoid DI container rebuilds.
// ============================================================================

export const letterClassifier = new LetterClassifier();
