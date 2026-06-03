/**
 * Letter Classifier
 *
 * Determines letter types and orientation characteristics for special placement logic.
 */

import type { PictographData } from "../../../../shared/domain/models/pictograph-data";

const HYBRID_LETTERS = [
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

const IN = "in";
const OUT = "out";

/**
 * Check if letter is HYBRID (uses motion type keys for special placement)
 */
export function isHybridLetter(letter: string): boolean {
  return HYBRID_LETTERS.includes(letter);
}

/**
 * Check if pictograph starts from standard orientation (both motions same layer)
 */
export function startsFromStandardOrientation(pictographData: PictographData): boolean {
  try {
    const blueMotion = pictographData.motions.blue;
    const redMotion = pictographData.motions.red;

    if (!blueMotion || !redMotion) {
      return true; // Default to standard
    }

    const blueStart = blueMotion.startOrientation || "";
    const redStart = redMotion.startOrientation || "";

    // Standard if both are layer1 (IN/OUT) or both are layer2 (CLOCK/COUNTER)
    const blueLayer1 = [IN, OUT].includes(blueStart);
    const redLayer1 = [IN, OUT].includes(redStart);

    return blueLayer1 === redLayer1; // Same layer = standard orientation
  } catch {
    return true; // Default to standard
  }
}
